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
const { exec } = require('child_process');


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

/**
 * Supprime tous les fichiers dans un répertoire.
 * @param {string} directory - Le chemin du dossier à nettoyer.
 * @param {Array<string>} exceptions - Liste de chemins de fichiers à ne pas supprimer.
 */
function cleanDirectory(directory, exceptions = []) {
  const files = fs.readdirSync(directory);
  files.forEach(file => {
    const filePath = path.join(directory, file);
    if (!exceptions.includes(filePath)) {
      try {
        fs.unlinkSync(filePath);
        console.log(`Fichier supprimé : ${filePath}`);
      } catch (err) {
        console.error(`Erreur lors de la suppression du fichier ${filePath} : ${err.message}`);
      }
    }
  });
}

/**
 * Transcrit l’audio en sous-titres `.srt` avec Whisper, exécuté via Docker.
 * Le conteneur Whisper sera lancé avec les volumes nécessaires pour accéder au fichier audio
 * et écrire le fichier de sortie.
 *
 * @param {string} audioPath - Chemin absolu du fichier audio sur l'hôte.
 * @param {string} outputDir - Chemin absolu du dossier de sortie sur l'hôte.
 * @returns {Promise<string>} - Chemin du fichier `.srt` généré.
 */
const generateSubtitles = (audioPath, outputDir) => {
  return new Promise((resolve, reject) => {
    // On récupère le répertoire et le nom du fichier audio
    const audioDir = path.dirname(audioPath);
    const audioFileName = path.basename(audioPath);
    // Chemin du fichier srt généré sur l'hôte
    const hostSubtitlePath = path.join(
      outputDir,
      `${path.basename(audioPath, path.extname(audioPath))}.srt`
    );
    
    console.log('Transcription de l’audio avec Whisper via Docker...');

    // Construction de la commande docker run :
    // - Le répertoire audio est monté dans /audio dans le conteneur.
    // - Le répertoire de sortie est monté dans /output dans le conteneur.
    // - Le conteneur exécute la commande Whisper sur le fichier monté.
    const command = `docker run --rm -v "${audioDir}":/audio -v "${outputDir}":/output whisper-cli /audio/${audioFileName} --model medium --language fr --output_format srt --output_dir /output`;

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Erreur lors de l'exécution de Whisper dans le conteneur: ${stderr}`);
        return reject(error);
      }
      console.log(`Sous-titres générés : ${hostSubtitlePath}`);
      resolve(hostSubtitlePath);
    });
  });
};

/**
 * Corrige les sous-titres `.srt` en les alignant avec le script original
 * @param {string} srtPath - Chemin du fichier `.srt` généré par Whisper
 * @param {string} scriptPath - Chemin du fichier contenant le script original
 * @param {string} outputDir - Dossier de sortie pour le fichier `.srt` corrigé
 * @returns {Promise<string>} - Chemin du fichier `.srt` corrigé
 */
const correctSubtitles = (srtPath, scriptPath, outputDir) => {
  return new Promise((resolve, reject) => {
    const correctedSrtPath = path.join(outputDir, 'corrected.srt');

    fs.readFile(srtPath, 'utf8', (err, srtData) => {
      if (err) return reject(err);

      fs.readFile(scriptPath, 'utf8', (err, scriptData) => {
        if (err) return reject(err);

        const scriptSentences = scriptData.split('. ');
        const srtLines = srtData.split('\n');

        let correctedSrt = '';
        let scriptIndex = 0;

        for (let i = 0; i < srtLines.length; i++) {
          if (srtLines[i].includes('-->')) {
            correctedSrt += srtLines[i] + '\n'; // Garder le timing original
          } else if (srtLines[i].trim() && !srtLines[i].match(/^\d+$/)) {
            // Remplacer le texte du sous-titre par le script correct
            if (scriptIndex < scriptSentences.length) {
              correctedSrt += scriptSentences[scriptIndex].trim() + '\n';
              scriptIndex++;
            }
          } else {
            correctedSrt += srtLines[i] + '\n';
          }
        }

        fs.writeFile(correctedSrtPath, correctedSrt, 'utf8', (err) => {
          if (err) return reject(err);
          console.log(`✅ Sous-titres corrigés générés : ${correctedSrtPath}`);
          resolve(correctedSrtPath);
        });
      });
    });
  });
};

const convertSrtToAss = (srtPath, outputDir) => {
  return new Promise((resolve, reject) => {
    const assPath = path.join(outputDir, `${path.basename(srtPath, '.srt')}.ass`);

    // En-tête du fichier ASS avec un style adapté (n'hésitez pas à ajuster Fontsize et MarginV)
    const assHeader = `[Script Info]
Title: Sous-titres TikTok
ScriptType: v4.00+
Collisions: Normal
PlayDepth: 0
Timer: 100.0000

[V4+ Styles]
; Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding
Style: TikTokStyle,Montserrat,12,&H00FFFFFF,&H000000FF,&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,2,2,2,20,20,50,1

[Events]
Format: Layer, Start, End, Style, MarginL, MarginR, MarginV, Effect, Text
`;

    // Convertit une chaîne de temps SRT ("HH:MM:SS,mmm") en secondes
    function timeStringToSeconds(timeString) {
      const regex = /(\d+):(\d+):(\d+),(\d+)/;
      const match = timeString.match(regex);
      if (!match) return 0;
      const hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      const seconds = parseInt(match[3], 10);
      const milliseconds = parseInt(match[4], 10);
      return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
    }

    // Convertit des secondes en format ASS ("H:MM:SS.cs")
    function secondsToAssTime(totalSeconds) {
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      const secondsStr = seconds.toFixed(2).padStart(5, '0'); // ex: "05.50"
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secondsStr}`;
    }

    fs.readFile(srtPath, 'utf8', (err, data) => {
      if (err) return reject(err);

      const lines = data.split('\n');
      let assBody = '';
      let startTimeSeconds = 0;
      let endTimeSeconds = 0;
      let textBuffer = '';
      let lastEndTime = 0; // Pour éviter que les sous-titres se chevauchent dans le même bloc

      // Fonction pour traiter un bloc de texte accumulé
      function processBlock() {
        if (!textBuffer) return;
        const words = textBuffer.trim().split(' ');
        const chunkSize = 4; // Nombre de mots par bloc
        const totalDuration = endTimeSeconds - startTimeSeconds;
        const timePerWord = totalDuration / words.length;

        for (let i = 0; i < words.length; i += chunkSize) {
          const chunkWords = words.slice(i, i + chunkSize).join(' ');
          let chunkStart = startTimeSeconds + i * timePerWord;
          let chunkEnd = startTimeSeconds + Math.min(i + chunkSize, words.length) * timePerWord;

          // Pour le même bloc, éviter le chevauchement interne
          if (chunkStart < lastEndTime) {
            chunkStart = lastEndTime;
          }
          if (chunkEnd > endTimeSeconds) {
            chunkEnd = endTimeSeconds;
          }

          const chunkStartStr = secondsToAssTime(chunkStart);
          const chunkEndStr = secondsToAssTime(chunkEnd);

          assBody += `Dialogue: 0,${chunkStartStr},${chunkEndStr},TikTokStyle,0,0,0,,{\\fad(200,200)} ${chunkWords}\n`;
          lastEndTime = chunkEnd;
        }
        // Réinitialiser pour le prochain bloc
        textBuffer = '';
        lastEndTime = 0;
      }

      lines.forEach((line) => {
        if (line.match(/^\d+$/)) {
          // Ignore les numéros de sous-titres
          return;
        } else if (line.includes('-->')) {
          // Si un bloc précédent avait du texte accumulé, le traiter avant de passer au suivant
          processBlock();

          // Extraction des timestamps et conversion en secondes
          const times = line.split('-->');
          startTimeSeconds = timeStringToSeconds(times[0].trim());
          endTimeSeconds = timeStringToSeconds(times[1].trim());
        } else if (line.trim()) {
          // Accumuler le texte du sous-titre
          textBuffer += line.trim() + ' ';
        } else {
          // Ligne vide : fin du bloc, traiter le texte accumulé
          processBlock();
        }
      });

      // Traiter le dernier bloc s'il n'est pas suivi d'une ligne vide
      processBlock();

      // Écriture du fichier ASS final
      fs.writeFile(assPath, assHeader + '\n' + assBody, 'utf8', (err) => {
        if (err) return reject(err);
        console.log(`✅ Sous-titres stylisés générés : ${assPath}`);
        resolve(assPath);
      });
    });
  });
};





/**
 * Ajoute des sous-titres à une vidéo.
 * @param {string} videoPath - Chemin du fichier vidéo.
 * @param {string} subtitlePath - Chemin du fichier sous-titres (.srt).
 * @param {string} outputPath - Chemin du fichier final.
 * @returns {Promise<void>}
 */
const addStyledSubtitlesToVideo = (videoPath, subtitlePath, outputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .outputOptions(`-vf ass=${subtitlePath}`)
      .on('end', () => {
        console.log('Sous-titres stylisés ajoutés à la vidéo.');
        resolve();
      })
      .on('error', (err) => {
        console.error('Erreur lors de l’ajout des sous-titres stylisés :', err.message);
        reject(err);
      })
      .save(outputPath);
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
  cleanDirectory,
  generateSubtitles,
  correctSubtitles,
  convertSrtToAss,
  addStyledSubtitlesToVideo,
};
