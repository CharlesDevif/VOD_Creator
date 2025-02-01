/**
 * index.js
 * Lance le script depuis la CLI et affiche le résultat final
 */

const path = require('path');
const fs = require('fs');
const { createFinalVod } = require('./createVod');

// Arguments
const videoUrl = process.argv[2];
const voiceFile = process.argv[3];
const scriptText = process.argv.slice(4).join(' '); // Récupérer le script complet depuis la CLI

// Chemin de base (dossiers 'vod', 'audio/voice', etc. doivent être dans ce répertoire)
const baseDir = __dirname;

(async () => {
  try {
    if (!videoUrl || !voiceFile || !scriptText) {
      throw new Error('Usage: node index.js <video_url> <voice_file> "<script_text>"');
    }

    // Définir le répertoire 'text' et le créer s'il n'existe pas
    const textDir = path.join(baseDir, 'text');
    if (!fs.existsSync(textDir)) {
      fs.mkdirSync(textDir, { recursive: true });
    }

    // Sauvegarder le script original dans un fichier temporaire
    const scriptPath = path.join(textDir, 'script_original.txt');
    fs.writeFileSync(scriptPath, scriptText, 'utf8');

    const finalPath = await createFinalVod(videoUrl, voiceFile, baseDir, scriptPath);
    console.log('✅ VOD finale créée avec succès :', finalPath);
  } catch (err) {
    console.error('❌ Erreur :', err.message);
    process.exit(1);
  }
})();
