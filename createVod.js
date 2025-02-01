/**
 * createVod.js
 */
const path = require('path');
const fs = require('fs');
const downloadVideoOnly = require('./downloadVideo');
const {
  ensureDirectoriesExist,
  getFileDuration,
  cutVideo,
  mergeAudioWithVideo,
  getRandomMusicFile,
  mixVoiceAndMusic,
  checkAndResizeVideo,
  // deleteFiles,  // On n'utilisera plus cette fonction pour le nettoyage
  cleanDirectory,
  generateSubtitles,
  correctSubtitles,
  convertSrtToAss,
  addStyledSubtitlesToVideo 
} = require('./utils');


/**
 * Crée une VOD finale au ratio 9:16,
 * coupée à la durée de la voix, avec musique de fond optionnelle.
 *
 * @param {string} videoUrl   - L'URL YouTube de la vidéo
 * @param {string} voiceFile  - Nom du fichier voix (ex: "ma_voix.mp3") dans audio/voice
 * @param {string} baseDir    - Dossier de base où se trouvent "vod", "audio/voice", "audio/music", "output" (et éventuellement "text")
 * @param {string} scriptPath - Chemin vers le script original pour correction des sous-titres
 * @returns {Promise<string>} - Chemin de la vidéo finale
 */
async function createFinalVod(videoUrl, voiceFile, baseDir, scriptPath) {
  try {
    // Définition des chemins de base
    const vodDir = path.join(baseDir, 'vod');
    const voiceDir = path.join(baseDir, 'audio', 'voice');
    const musicDir = path.join(baseDir, 'audio', 'music');
    const outputDir = path.join(baseDir, 'output');
    const textDir = path.join(baseDir, 'text'); // Supposons que ce dossier existe pour stocker les fichiers textes (par exemple, scripts ou sous-titres)

    // S'assurer que les dossiers nécessaires existent
    ensureDirectoriesExist([vodDir, voiceDir, musicDir, outputDir]);

    // Vérifier l'existence du fichier voix
    const voicePath = path.join(voiceDir, voiceFile);
    if (!fs.existsSync(voicePath)) {
      throw new Error(`Fichier voix introuvable : ${voicePath}`);
    }

    // Télécharger la vidéo (sans audio)
    console.log('Téléchargement de la vidéo...');
    const videoPath = await downloadVideoOnly(videoUrl, vodDir);

    // Redimensionner la vidéo au ratio 9:16
    const resizedVideoPath = path.join(outputDir, `resized_${path.basename(videoPath)}`);
    console.log('Redimensionnement de la vidéo au ratio 9:16...');
    const finalRatioVideoPath = await checkAndResizeVideo(videoPath, resizedVideoPath);

    // Récupérer les durées de la voix et de la vidéo en parallèle
    console.log('Récupération des durées...');
    const [voiceDuration, videoDuration] = await Promise.all([
      getFileDuration(voicePath),
      getFileDuration(finalRatioVideoPath),
    ]);

    // // Lever une erreur si la durée de la voix dépasse celle de la vidéo
    // if (voiceDuration > videoDuration) {
    //   throw new Error('La durée de la voix est supérieure à celle de la vidéo.');
    // }
    
    // Mixer la voix avec une musique de fond aléatoire
    const randomMusicPath = getRandomMusicFile(musicDir);
    const voiceFileName = path.basename(voiceFile, path.extname(voiceFile));
    const mixedAudioName = `mixed_${voiceFileName}.m4a`;
    const mixedAudioPath = path.join(outputDir, mixedAudioName);
    console.log('Mixage de la voix et de la musique...');
    await mixVoiceAndMusic(voicePath, randomMusicPath, mixedAudioPath, 1.0, 0.3);

    // Découper la vidéo à la durée de la voix
    const cutVideoPath = path.join(outputDir, `cut_${path.basename(finalRatioVideoPath)}`);
    console.log('Découpage de la vidéo à la durée de la voix...');
    await cutVideo(finalRatioVideoPath, cutVideoPath, 0, voiceDuration);

    // Fusionner l'audio mixé avec la vidéo coupée
    const finalVideoPath = path.join(outputDir, `final_${path.basename(finalRatioVideoPath)}`);
    console.log('Fusion de l\'audio mixé avec la vidéo...');
    await mergeAudioWithVideo(cutVideoPath, mixedAudioPath, finalVideoPath);

    // Génération des sous-titres via Whisper
    console.log('Génération des sous-titres avec Whisper...');
    const subtitlePath = await generateSubtitles(mixedAudioPath, outputDir);

    // Correction des sous-titres en utilisant le script original
    console.log('Correction des sous-titres...');
    const correctedSubtitlePath = await correctSubtitles(subtitlePath, scriptPath, outputDir);

    // Conversion des sous-titres en ASS stylisés
    console.log('Conversion des sous-titres en format ASS stylisé...');
    const styledSubtitlePath = await convertSrtToAss(correctedSubtitlePath, outputDir);

    // Ajout des sous-titres stylisés à la vidéo finale
    const videoWithSubtitlesPath = path.join(outputDir, `final_with_subs_${path.basename(finalVideoPath)}`);
    console.log('Ajout des sous-titres à la vidéo...');
    await addStyledSubtitlesToVideo(finalVideoPath, styledSubtitlePath, videoWithSubtitlesPath);

    // Nettoyage : suppression de tous les fichiers temporaires dans output, vod et text
    console.log('Nettoyage des fichiers temporaires...');

    // Dans le dossier output, on conserve uniquement la VOD finale
    cleanDirectory(outputDir, [videoWithSubtitlesPath]);

    // Dans le dossier vod, on supprime tous les fichiers
    cleanDirectory(vodDir);

    // Si le dossier text existe, on le nettoie entièrement
    if (fs.existsSync(textDir)) {
      cleanDirectory(textDir);
    }

    console.log('✅ VOD finale créée avec succès :', videoWithSubtitlesPath);
    return videoWithSubtitlesPath;
  } catch (error) {
    console.error('❌ Erreur lors de la création de la VOD finale :', error.message);
    throw error;
  }
}

module.exports = { createFinalVod };
