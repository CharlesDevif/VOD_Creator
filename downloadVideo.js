/**
 * downloadVideo.js
 * Gère le téléchargement d’une vidéo YouTube en format "video only" (pas de piste audio).
 */

const fs = require('fs');
const path = require('path');
const ytdl = require('@distube/ytdl-core');
const cliProgress = require('cli-progress');
const puppeteer = require('puppeteer');

const COOKIES_PATH = 'cookies.json';

/**
 * Vérifie si le fichier `cookies.json` existe.
 * @returns {boolean} - Retourne `true` si le fichier existe, sinon `false`.
 */
function cookiesExist() {
  return fs.existsSync(COOKIES_PATH);
}

/**
 * Récupère les cookies de YouTube via Puppeteer et les enregistre dans `cookies.json`.
 * @returns {Promise<Array>} - Un tableau d'objets cookie.
 */
const puppeteer = require('puppeteer');

async function getYoutubeCookies() {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium-browser', // Utilisation de Chromium installé via apk
    headless: true,
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-software-rasterizer'
    ],
  });

  const page = await browser.newPage();
  await page.goto('https://www.youtube.com', { waitUntil: 'networkidle2' });

  const cookies = await page.cookies();
  await browser.close();
  return cookies;
}


/**
 * Charge les cookies de YouTube depuis `cookies.json` ou les récupère avec Puppeteer si nécessaire.
 * @returns {Promise<Array>} - Tableau des cookies.
 */
async function loadCookies() {
  if (cookiesExist()) {
    console.log('📂 Chargement des cookies depuis cookies.json');
    return JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
  } else {
    return await getYoutubeCookies();
  }
}

/**
 * Crée un agent pour ytdl-core en utilisant les cookies récupérés.
 * @returns {Promise<Object>} - L'agent créé par ytdl.createAgent.
 */
async function createYtdlAgent() {
  const cookies = await loadCookies();
  return ytdl.createAgent(cookies);
}

// Headers supplémentaires pour imiter un vrai navigateur
const defaultHeaders = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
  'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
  'Referer': 'https://www.youtube.com/'
};

/**
 * Télécharge la vidéo depuis YouTube (sans piste audio).
 * @param {string} url - L’URL de la vidéo YouTube.
 * @param {string} outputDir - Le dossier de sortie.
 * @returns {Promise<string>} - Le chemin du fichier téléchargé.
 */
const downloadVideoOnly = async (url, outputDir) => {
  try {
    // Créer l'agent avec cookies récupérés
    const agent = await createYtdlAgent();

    // Extraire l’ID de la vidéo
    const videoId = new URL(url).searchParams.get('v');
    if (!videoId) {
      throw new Error('Impossible d’extraire l’ID de la vidéo');
    }

    const fileName = `vod_${videoId}_noaudio.mp4`;
    const outputPath = path.join(outputDir, fileName);

    console.log(`📥 Téléchargement de la vidéo sans audio : ${fileName}...\n`);

    // Récupérer les informations sur la vidéo
    const info = await ytdl.getInfo(url, { agent, headers: defaultHeaders });
    const format = ytdl.chooseFormat(info.formats, {
      quality: 'highestvideo',
      filter: 'videoonly',
    });
    const totalSize = parseInt(format.contentLength, 10) || 0;

    // Initialiser la barre de progression
    const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    progressBar.start(totalSize, 0);

    let downloadedSize = 0;

    // Télécharger la vidéo
    await new Promise((resolve, reject) => {
      ytdl(url, { 
          quality: 'highestvideo', 
          filter: 'videoonly',
          agent,
          headers: defaultHeaders 
        })
        .on('progress', (chunkLength) => {
          downloadedSize += chunkLength;
          progressBar.update(downloadedSize);
        })
        .pipe(fs.createWriteStream(outputPath))
        .on('finish', () => {
          progressBar.update(totalSize);
          progressBar.stop();
          console.log(`✅ Téléchargement terminé : ${outputPath}`);
          resolve();
        })
        .on('error', (err) => {
          progressBar.stop();
          reject(err);
        });
    });

    return outputPath;
  } catch (error) {
    console.error('❌ Erreur lors du téléchargement :', error.message);
    throw error;
  }
};

module.exports = downloadVideoOnly;
