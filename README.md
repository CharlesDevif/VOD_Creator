# VOD Creator - Fusion Automatique Vidéo et Audio 🎥

Ce projet est un outil Node.js conçu pour télécharger des vidéos YouTube sans piste audio, redimensionner les vidéos, couper leur durée pour correspondre à une piste audio, et fusionner la vidéo et l'audio pour créer une VOD finale au format 9:16.

---

## 🚀 Fonctionnalités

- **Téléchargement YouTube sans audio** : Télécharge une vidéo en qualité optimale sans piste audio.
- **Redimensionnement des vidéos** : Recadre les vidéos au format 9:16 pour les plateformes comme TikTok ou Instagram.
- **Fusion audio/vidéo** : Combine une piste audio (voix) et une vidéo pour créer une sortie homogène.
- **Ajout de musique de fond** : Mélange une piste audio de musique avec la voix pour un rendu plus professionnel.
- **Suppression des fichiers temporaires** : Nettoie les fichiers intermédiaires inutiles après la création de la vidéo finale.

---

## 🛠️ Installation

### Pré-requis

- Node.js (v16 ou supérieur recommandé)
- FFmpeg installé sur votre machine ([instructions ici](https://ffmpeg.org/download.html))

### Étapes d'installation

1. Clonez ce dépôt :
   ```bash
   git clone <URL_DU_DEPOT>
   cd <NOM_DU_DOSSIER>
   ```
2. Installez les dépendances :
   ```bash
   npm install
   ```

---

## 📝 Utilisation

### Commande principale

```bash
node index.js <URL_YOUTUBE> <NOM_DU_FICHIER_AUDIO>
```

### Arguments

- **`<URL_YOUTUBE>`** : URL de la vidéo YouTube à télécharger.
- **`<NOM_DU_FICHIER_AUDIO>`** : Nom du fichier audio (ex. : `voice.mp3`) situé dans le dossier `audio/voice`.

### Exemple

```bash
node index.js "https://www.youtube.com/watch?v=YOUR_VIDEO_ID" "audio_2025-01-24_21_hours_and_38_minutes.mp3"
```

---

## 📂 Structure des dossiers

Voici la structure des dossiers utilisée par le projet :

```
.
├── vod/               # Vidéos téléchargées sans audio
├── audio/
│   ├── voice/        # Fichiers audio de voix
│   └── music/        # Fichiers audio de musique (optionnel)
├── output/            # Vidéos finales générées
├── utils.js           # Fonctions utilitaires
├── downloadVideo.js   # Téléchargement de vidéos
├── createVod.js       # Logique principale de création de VOD
├── index.js           # Point d'entrée principal
└── package.json       # Dépendances et métadonnées du projet
```

---

## 🛠️ Fonctionnalités principales

### 1. Téléchargement YouTube sans audio

- Télécharge la vidéo en qualité optimale sans inclure l'audio.
- Utilise `ytdl-core` pour récupérer la vidéo.

### 2. Redimensionnement vidéo

- Vérifie et recadre les vidéos au format 9:16 (ex : 720x1280).
- Utilise `FFmpeg` pour ajuster les dimensions et appliquer des filtres.

### 3. Fusion audio/vidéo

- Combine une piste audio (voix) avec une vidéo en utilisant `FFmpeg`.
- Ajoute une musique de fond optionnelle avec contrôle du volume.

### 4. Suppression des fichiers inutiles

- Supprime automatiquement les fichiers temporaires générés pendant le traitement (vidéos redimensionnées, pistes audio mixées, etc.).

---

## 📋 Dépendances principales

- **[fluent-ffmpeg](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg)** : Interface Node.js pour FFmpeg.
- **[ytdl-core](https://github.com/fent/node-ytdl-core)** : Téléchargement de vidéos YouTube.
- **[cli-progress](https://github.com/AndiDittrich/Node.CLI-Progress)** : Affichage des barres de progression.

---

## 📌 Améliorations futures

- Ajouter un système de configuration pour personnaliser les ratios, volumes et formats.
- Implémenter un système de logs détaillés pour le débogage.
- Support de multiples formats de sortie (ex. : `.avi`, `.mov`, etc.).
- Intégration avec des API pour uploader directement sur des plateformes (ex. : TikTok, Instagram).

---

## 🤝 Contribuer

1. Forkez ce dépôt.
2. Créez une branche feature :
   ```bash
   git checkout -b ma-nouvelle-feature
   ```
3. Commitez vos changements :
   ```bash
   git commit -m "Ajout de ma nouvelle fonctionnalité"
   ```
4. Poussez vos changements :
   ```bash
   git push origin ma-nouvelle-feature
   ```
5. Créez une Pull Request.

---

## 📜 Licence

Ce projet est sous licence [MIT](LICENSE).

---

## 🧑‍💻 Auteurs

- **Charles Devif** - Développeur principal
- Contactez-moi pour toute question ou suggestion : [charlesdevif@hotmail.fr](charlesdevif@hotmail.fr)

---

### Merci d'utiliser VOD Creator ! 🙌
