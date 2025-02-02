const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const cliProgress = require('cli-progress');

/**
 * Télécharge une vidéo YouTube en format "vidéo only" (sans audio) avec `yt-dlp`
 * @param {string} url - URL de la vidéo YouTube
 * @param {string} outputDir - Dossier de sortie
 * @returns {Promise<string>} - Chemin du fichier téléchargé
 */
const downloadVideoOnly = async (url, outputDir) => {
  return new Promise((resolve, reject) => {
    try {
      // Extraire l'ID de la vidéo
      const videoId = new URL(url).searchParams.get('v');
      if (!videoId) {
        throw new Error('Impossible d’extraire l’ID de la vidéo');
      }

      const fileName = `vod_${videoId}_noaudio.mp4`;
      const outputPath = path.join(outputDir, fileName);
      
      console.log(`📥 Téléchargement de la vidéo sans audio : ${fileName}...\n`);

      // Commande yt-dlp pour télécharger uniquement la vidéo sans audio
      const command = `yt-dlp -f "137" --cookies cookies.txt -o "${outputPath}" "${url}"`;

      // Initialisation de la barre de progression
      const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
      progressBar.start(100, 0); 

      // Exécution de la commande yt-dlp
      const process = exec(command, (error, stdout, stderr) => {
        progressBar.stop();
        
        if (error) {
          console.error('❌ Erreur lors du téléchargement :', stderr);
          return reject(error);
        }

        console.log(`✅ Téléchargement terminé : ${outputPath}`);
        resolve(outputPath);
      });

      // Mise à jour de la barre de progression (fake estimation)
      process.stdout.on('data', (data) => {
        const match = data.match(/\[download\] +(\d+(\.\d+)?)%/);
        if (match) {
          const percent = parseFloat(match[1]);
          progressBar.update(percent);
        }
      });

    } catch (error) {
      console.error('❌ Erreur lors du téléchargement :', error.message);
      reject(error);
    }
  });
};

module.exports = downloadVideoOnly;
