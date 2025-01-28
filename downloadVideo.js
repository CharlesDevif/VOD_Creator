/**
 * downloadVideo.js
 * Gère le téléchargement d’une vidéo Youtube
 * en format "video only" (pas de piste audio).
 */

const fs = require('fs');
const path = require('path');
const ytdl = require('@distube/ytdl-core');
const cliProgress = require('cli-progress'); // Pour l’affichage de la progression

/**
 * Télécharge la vidéo depuis YouTube (sans piste audio).
 * @param {string} url - L’URL de la vidéo YouTube
 * @param {string} outputDir - Le dossier de sortie
 * @returns {Promise<string>} - Le chemin du fichier téléchargé
 */
const downloadVideoOnly = async (url, outputDir) => {
  try {
    // Extraire l’ID de la vidéo
    const videoId = new URL(url).searchParams.get('v');
    if (!videoId) {
      throw new Error('Impossible d’extraire l’ID de la vidéo');
    }

    const fileName = `vod_${videoId}_noaudio.mp4`;
    const outputPath = path.join(outputDir, fileName);

    console.log(`Téléchargement de la vidéo sans audio : ${fileName}...\n`);

    // Récupérer les informations sur la vidéo
    const info = await ytdl.getInfo(url);
    const format = ytdl.chooseFormat(info.formats, {
      quality: 'highestvideo',
      filter: 'videoonly',
    });
    const totalSize = parseInt(format.contentLength, 10); // Taille totale en octets

    // Initialiser la barre de progression
    const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    progressBar.start(totalSize, 0);

    let downloadedSize = 0;

    // Télécharger la vidéo avec progression
    await new Promise((resolve, reject) => {
      ytdl(url, { quality: 'highestvideo', filter: 'videoonly' })
        .on('progress', (chunkLength) => {
          downloadedSize += chunkLength;
          progressBar.update(downloadedSize); // Mettre à jour la barre de progression
        })
        .pipe(fs.createWriteStream(outputPath))
        .on('finish', () => {
          progressBar.update(totalSize);
          progressBar.stop();
          console.log(`Téléchargement terminé : ${outputPath}`);
          resolve();
        })
        .on('error', (err) => {
          progressBar.stop();
          reject(err);
        });
    });

    return outputPath;
  } catch (error) {
    console.error('Erreur lors du téléchargement :', error.message);
    throw error;
  }
};

module.exports = downloadVideoOnly;
