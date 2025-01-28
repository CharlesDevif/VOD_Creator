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
  deleteFiles,
} = require('./utils');

/**
 * Crée une VOD finale au ratio 9:16,
 * coupée à la durée de la voix, avec musique de fond optionnelle.
 *
 * @param {string} videoUrl   - L'URL YouTube de la vidéo
 * @param {string} voiceFile  - Nom du fichier voix (ex: "ma_voix.mp3") dans audio/voice
 * @param {string} baseDir    - Dossier de base où se trouvent "vod", "audio/voice", "audio/music", "output"
 * @returns {Promise<string>}   - Chemin de la vidéo finale
 */
async function createFinalVod(videoUrl, voiceFile, baseDir) {
  const vodDir = path.join(baseDir, 'vod');
  const voiceDir = path.join(baseDir, 'audio', 'voice');
  const musicDir = path.join(baseDir, 'audio', 'music');
  const outputDir = path.join(baseDir, 'output');

  ensureDirectoriesExist([vodDir, voiceDir, musicDir, outputDir]);

  const voicePath = path.join(voiceDir, voiceFile);
  if (!fs.existsSync(voicePath)) {
    throw new Error(`Fichier voix introuvable : ${voicePath}`);
  }

  const videoPath = await downloadVideoOnly(videoUrl, vodDir);
  const resizedVideoPath = path.join(outputDir, `resized_${path.basename(videoPath)}`);
  const finalRatioVideoPath = await checkAndResizeVideo(videoPath, resizedVideoPath);

  const [voiceDuration, videoDuration] = await Promise.all([
    getFileDuration(voicePath),
    getFileDuration(finalRatioVideoPath),
  ]);

  if (voiceDuration > videoDuration) {
    deleteFiles([videoPath,resizedVideoPath]);
    throw new Error(
      `La vidéo (${videoDuration.toFixed(2)}s) est plus courte que la voix (${voiceDuration.toFixed(2)}s).`
    );
  }

  const randomMusicPath = getRandomMusicFile(musicDir);
  const mixedAudioName = `mixed_${path.basename(voiceFile, path.extname(voiceFile))}.m4a`;
  const mixedAudioPath = path.join(outputDir, mixedAudioName);
  await mixVoiceAndMusic(voicePath, randomMusicPath, mixedAudioPath, 1.0, 0.3);

  const cutVideoPath = path.join(outputDir, `cut_${path.basename(finalRatioVideoPath)}`);
  await cutVideo(finalRatioVideoPath, cutVideoPath, 0, voiceDuration);

  const finalVideoPath = path.join(outputDir, `final_${path.basename(finalRatioVideoPath)}`);
  await mergeAudioWithVideo(cutVideoPath, mixedAudioPath, finalVideoPath);

  // Suppression des fichiers inutiles
  deleteFiles([videoPath, resizedVideoPath, cutVideoPath, mixedAudioPath]);

  return finalVideoPath;
}

module.exports = { createFinalVod };
