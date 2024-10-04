const express = require('express');
const multer = require('multer');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

// Set storage engine
const storage = multer.diskStorage({
    destination: './uploads',
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + file.originalname;
        cb(null, uniqueName);
    }
});

// Initialize upload
const upload = multer({ storage: storage }).single('videoFile');

// Serve static files from the public directory
app.use(express.static('public'));
// Serve HLS files
app.use('/hls', express.static(path.join(__dirname, 'hls')));

// Upload and convert video to HLS
app.post('/upload', (req, res) => {
    upload(req, res, (err) => {
        if (err) {
            return res.send('Error uploading file');
        }
        if (!req.file) {
            return res.send('No file selected');
        }

        convertToHLS(req.file.path, req.file.filename).then(() => {
            res.send(`Video uploaded and converted to HLS successfully! <br>
                      <a href="/">Go back</a> <br>
                      <a href="/hls/${path.basename(req.file.filename, path.extname(req.file.filename))}-720p.m3u8">Watch Video</a>`);
        }).catch(err => {
            res.send('Error during HLS conversion');
        });
    });
});

// Convert video to HLS with one resolution (720p)
function convertToHLS(inputPath, originalFilename) {
    return new Promise((resolve, reject) => {
        const outputDirectory = path.join(__dirname, 'hls');
        if (!fs.existsSync(outputDirectory)) {
            fs.mkdirSync(outputDirectory);
        }

        const outputHLSName = `${path.basename(originalFilename, path.extname(originalFilename))}-720p.m3u8`;

        ffmpeg(inputPath)
            .outputOptions([
                '-vf scale=1280:-2', // Scale to 720p
                '-hls_time 10',
                '-hls_list_size 0',
                '-f hls'
            ])
            .on('end', () => {
                console.log(`HLS streaming files created: ${outputHLSName}`);
                resolve();
            })
            .on('error', (err) => {
                console.error(`Error during HLS conversion:`, err);
                reject(err);
            })
            .save(path.join(outputDirectory, outputHLSName));
    });
}

// Start server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
