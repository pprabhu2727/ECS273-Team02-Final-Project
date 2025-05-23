const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

const serverDir = path.resolve(__dirname, '../server');

function waitForServer(url, retries = 30, interval = 1000) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      http.get(url, res => {
        if (res.statusCode === 200) {
          console.log("✅ FastAPI server is up!");
          resolve();
        } else {
          retry();
        }
      }).on('error', retry);
    };
    const retry = () => {
      attempts++;
      if (attempts >= retries) {
        reject(new Error("❌ Server did not start in time."));
      } else {
        setTimeout(check, interval);
      }
    };
    check();
  });
}

(async () => {
  try {
    if (!fs.existsSync(serverDir)) {
      throw new Error("❌ '../server' folder not found!");
    }

    console.log("📦 Installing Python dependencies...");
    execSync('pip install -r requirements.txt', {
      cwd: serverDir,
      stdio: 'inherit'
    });

    console.log("🛠️ Running data_scheme.py...");
    execSync('python data_scheme.py', {
      cwd: serverDir,
      stdio: 'inherit'
    });

    console.log("📊 Importing data...");
    execSync('python import_data.py', {
      cwd: serverDir,
      stdio: 'inherit'
    });

    console.log("🚀 Starting FastAPI server on port 8000...");
    const backendProcess = spawn('uvicorn', ['main:app', '--reload', '--port', '8000'], {
      cwd: serverDir,
      stdio: 'inherit',
      shell: true
    });

    // Wait for backend to be up
    await waitForServer('http://localhost:8000/species_list');

    console.log("🌐 Starting Vite frontend...");
    spawn('npx', ['vite', '--open'], {
  cwd: path.resolve(__dirname, '../client'),

      stdio: 'inherit',
      shell: true
    });

  } catch (err) {
    console.error("❌ Setup failed:", err.message);
    process.exit(1);
  }
})();
