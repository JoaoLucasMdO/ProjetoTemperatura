const { spawn } = require('child_process');

// Função para executar um arquivo index.js em uma pasta específica
function startScript(scriptPath) {
  const process = spawn('node', [scriptPath], { stdio: 'inherit' });
 
  process.on('close', (code) => {
    console.log(`Script ${scriptPath} finalizado com código ${code}`);
  });
 
  process.on('error', (err) => {
    console.error(`Erro ao executar o script ${scriptPath}:`, err);
  });
 
  return process;
}
 
// Caminhos dos scripts
const script1 = 'api/index.js';
 
// Iniciar os dois scripts
startScript(script1);