/**
 * utils.js
 * Fonctions utilitaires : création de dossiers, extraction d’ID,
 * récupération durée (ffprobe), découpe vidéo, fusion audio/vidéo,
 * mixage de deux pistes audio (voix + musique), etc.
 */

const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const cliProgress = require('cli-progress');

/**
 * Vérifie si les dossiers existent, sinon les crée.
 * @param {Array<string>} dirs - Liste des chemins des dossiers.
 */
const ensureDirectoriesExist = (dirs) => {
  dirs.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

/**
 * Extrait l'ID d'une vidéo YouTube à partir de l'URL.
 * @param {string} url - URL de la vidéo YouTube.
 * @returns {string|null} - ID de la vidéo, ou null si introuvable
 */
const extractVideoId = (url) => {
  const urlObj = new URL(url);
  return urlObj.searchParams.get('v');
};

/**
 * Récupère la durée d'un fichier audio ou vidéo (en secondes).
 * @param {string} filePath - Chemin du fichier.
 * @returns {Promise<number>} - Durée en secondes.
 */
const getFileDuration = (filePath) =>
  new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration); // Durée en secondes
    });
  });

/**
 * Découpe une vidéo pour une durée donnée à partir d'un point de départ.
 * @param {string} videoPath - Chemin de la vidéo.
 * @param {string} outputPath - Chemin de sortie.
 * @param {number} startTime - Temps de début en secondes.
 * @param {number} duration - Durée à découper, en secondes.
 * @returns {Promise<void>}
 */
const cutVideo = (videoPath, outputPath, startTime, duration) =>
  new Promise((resolve, reject) => {
    const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    progressBar.start(100, 0);

    ffmpeg(videoPath)
      .setStartTime(startTime)
      .setDuration(duration)
      .output(outputPath)
      .on('progress', (progress) => {
        if (progress.percent) {
          progressBar.update(Math.min(progress.percent, 100));
        }
      })
      .on('end', () => {
        progressBar.update(100);
        progressBar.stop();
        resolve();
      })
      .on('error', (err) => {
        progressBar.stop();
        reject(err);
      })
      .run();
  });

/**
 * Fusionne une vidéo et un fichier audio (une seule piste).
 * @param {string} videoPath - Chemin de la vidéo.
 * @param {string} audioPath - Chemin de l'audio.
 * @param {string} outputPath - Chemin du fichier de sortie.
 * @returns {Promise<void>}
 */
const mergeAudioWithVideo = (videoPath, audioPath, outputPath) =>
  new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .input(audioPath)
      .outputOptions([
        '-map 0:v:0',   // On prend la piste vidéo du premier input
        '-map 1:a:0',   // On prend la piste audio du second input
        '-c:v copy',    // On copie la vidéo sans réencoder
        '-c:a aac',     // On encode l’audio en AAC
        '-shortest',    // On limite la durée au plus court des deux flux
      ])
      .on('progress', (progress) => {
        if (progress.percent) {
          process.stdout.write(`Fusion vidéo+audio : ${Math.round(progress.percent)}%   \r`);
        }
      })
      .on('end', () => {
        console.log('\nFusion terminée avec succès.');
        resolve();
      })
      .on('error', (err) => {
        console.error('Erreur lors de la fusion :', err.message);
        reject(err);
      })
      .save(outputPath);
  });

/**
 * Sélectionne un fichier musical aléatoire dans un dossier donné.
 * @param {string} musicDir - Chemin du dossier de musiques
 * @returns {string} - Chemin absolu du fichier musical sélectionné
 */
const getRandomMusicFile = (musicDir) => {
  const files = fs.readdirSync(musicDir);
  if (!files.length) {
    throw new Error(`Aucun fichier musical trouvé dans ${musicDir}`);
  }
  // Sélection aléatoire
  const randomFile = files[Math.floor(Math.random() * files.length)];
  return path.join(musicDir, randomFile);
};

/**
 * Mixe deux pistes audio (voix & musique) en une seule,
 * ajustant le volume de chaque piste, via le filtre FFmpeg amix.
 * @param {string} voicePath  - Chemin du fichier de voix
 * @param {string} musicPath  - Chemin du fichier de musique
 * @param {string} outputPath - Chemin du fichier audio de sortie
 * @param {number} voiceVolume - Volume pour la voix (1.0 = 100%)
 * @param {number} musicVolume - Volume pour la musique (0.3 = 30%)
 * @returns {Promise<void>}
 */
const mixVoiceAndMusic = (voicePath, musicPath, outputPath, voiceVolume = 1.0, musicVolume = 0.1) =>
  new Promise((resolve, reject) => {
    const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    progressBar.start(100, 0);

    ffmpeg()
      .input(voicePath)
      .input(musicPath)
      // Utilise un filtre complexe pour superposer les deux pistes avec des volumes différents
      .complexFilter([
        `[0:a]volume=${voiceVolume}[voice]`,
        `[1:a]volume=${musicVolume}[music]`,
        '[voice][music]amix=inputs=2:duration=longest[aout]',
      ])
      .outputOptions([
        '-map [aout]',
        '-c:a aac', // Encode en AAC
      ])
      .on('progress', (progress) => {
        if (progress.percent) {
          progressBar.update(Math.min(progress.percent, 100));
        }
      })
      .on('end', () => {
        progressBar.update(100);
        progressBar.stop();
        console.log('Mixage voix+musique terminé.');
        resolve();
      })
      .on('error', (err) => {
        progressBar.stop();
        console.error('Erreur lors du mixage audio :', err.message);
        reject(err);
      })
      .save(outputPath);
  });

/**
 * Vérifie le ratio d'une vidéo et la recadre/rognée en 9:16 si nécessaire,
 * en affichant une barre de progression pendant l'encodage.
 *
 * @param {string} inputPath  - Chemin de la vidéo d'entrée
 * @param {string} outputPath - Chemin de la vidéo de sortie
 * @returns {Promise<string>}   Retourne le chemin de la vidéo finale (9:16)
 */
const checkAndResizeVideo = (inputPath, outputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) return reject(err);

      // Récupérer la largeur et la hauteur de la première piste vidéo
      const videoStream = metadata.streams.find(s => s.width && s.height);
      if (!videoStream) {
        return reject(new Error('Impossible de récupérer les dimensions de la vidéo'));
      }
      const { width, height } = videoStream;

      // Ratio actuel de la vidéo
      const currentRatio = width / height;
      // Ratio cible : 9/16 ~ 0.5625
      const targetRatio = 9 / 16;

      // Vérification du ratio avec une petite tolérance
      if (Math.abs(currentRatio - targetRatio) < 0.001) {
        console.log('La vidéo est déjà au ratio 9:16, pas de recadrage nécessaire.');
        return resolve(inputPath); // On peut retourner directement la vidéo d'origine
      } else {
        console.log(`Vidéo au ratio ${currentRatio.toFixed(3)}, recadrage en 9:16...`);

        // Choisissez une résolution finale (ex: 720x1280 ou 1080x1920)
        const finalWidth = 720;
        const finalHeight = 1280;

        // Barre de progression
        const progressBar = new cliProgress.SingleBar(
          {
            format: 'Recadrage 9:16 |{bar}| {percentage}% | ETA: {eta}s',
          },
          cliProgress.Presets.shades_classic
        );
        progressBar.start(100, 0);

        ffmpeg(inputPath)
          .videoFilters([
            // 1) On agrandit la vidéo pour qu'elle "couvre" au moins 720x1280
            `scale=${finalWidth}:${finalHeight}:force_original_aspect_ratio=increase`,
            // 2) On crop le surplus pour avoir exactement 720x1280
            `crop=${finalWidth}:${finalHeight}`,
          ])
          // Copier l'audio tel quel
          .outputOptions(['-c:a copy'])
          .on('progress', (progress) => {
            if (progress.percent) {
              progressBar.update(Math.min(progress.percent, 100));
            }
          })
          .on('error', (err) => {
            progressBar.stop();
            reject(new Error(`Erreur recadrage 9:16: ${err.message}`));
          })
          .on('end', () => {
            progressBar.update(100);
            progressBar.stop();
            console.log('Recadrage 9:16 terminé. Fichier créé :', outputPath);
            resolve(outputPath);
          })
          .save(outputPath);
      }
    });
  });
};

const deleteFiles = (filePaths) => {
  filePaths.forEach((filePath) => {
    if (fs.existsSync(filePath)) {
      fs.unlink(filePath, (err) => {
        if (err) {
          console.error(`Erreur lors de la suppression du fichier : ${filePath}`, err.message);
        } else {
          console.log(`Fichier supprimé : ${filePath}`);
        }
      });
    }
  });
};



// On exporte toutes les fonctions utilitaires
module.exports = {
  ensureDirectoriesExist,
  extractVideoId,
  getFileDuration,
  cutVideo,
  mergeAudioWithVideo,
  getRandomMusicFile,
  mixVoiceAndMusic,
  checkAndResizeVideo,
  deleteFiles,
};
