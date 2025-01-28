/**
 * index.js
 * Lance le script depuis la CLI et affiche le résultat final
 */

const path = require('path');
const { createFinalVod } = require('./createVod');

// Arguments
const videoUrl = process.argv[2];
const voiceFile = process.argv[3];

// Chemin de base (dossiers 'vod', 'audio/voice', etc. doivent être dans ce répertoire)
const baseDir = __dirname;

(async () => {
  try {
    const finalPath = await createFinalVod(videoUrl, voiceFile, baseDir);
    console.log('VOD finale créée avec succès :', finalPath);
  } catch (err) {
    console.error('Erreur :', err.message);
    process.exit(1);
  }
})();
