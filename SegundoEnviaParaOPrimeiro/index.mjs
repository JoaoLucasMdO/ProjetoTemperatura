import { BluetoothSerialPort } from "bluetooth-serial-port";
import axios from "axios";
import open from "open";

const btSerialPort = new BluetoothSerialPort();
const hc05Address = "98:D3:31:F9:3F:35"; // Endereço do HC-05
const apiUrl = "http://localhost:3000/sendData";
const graficoUrl = "http://localhost:3000/";
var contador = 0;
let buffer = ""; // Buffer temporário para os dados

async function exibirGrafico() {
  try {
    contador++;
    await open(graficoUrl);
    console.log("Gráfico aberto no navegador.");
  } catch (error) {
    console.error("Erro ao abrir o gráfico:", error.message);
  }
}

// Tente conectar ao HC-05
btSerialPort.connect(hc05Address, 1, (err, status) => {
  if (err) {
    console.error("Erro ao conectar:", err);
    return;
  }

  console.log("Conectado ao HC-05");

  // Quando receber dados
  btSerialPort.on("data", (data) => {
    const receivedData = data.toString("utf-8").trim();
    console.log("Dados recebidos:", receivedData);

    buffer += receivedData; // Adiciona os dados ao buffer

    // Verifique se temos um JSON completo no buffer
    if (buffer.startsWith("{") && buffer.endsWith("}")) {
      try {
        const jsonData = JSON.parse(buffer);
        sendData(jsonData);
        buffer = ""; // Limpa o buffer após o envio bem-sucedido
      } catch (e) {
        console.log("Erro ao analisar JSON:", e.message);
        // Se falhar, continue acumulando no buffer
      }
    } else {
      console.log("Aguardando dados completos...");
    }
  });

  // Função para enviar dados
  async function sendData(jsonData) {
    try {
      const response = await axios.post(apiUrl, jsonData);
      console.log(
        `Resposta da API: ${response.status} - ${response.statusText}`
      );
      if (contador == 0) {
        await exibirGrafico();
      }
    } catch (error) {
      console.error(`Erro ao enviar dados para a API: ${error.message}`);
    }
  }

  // Tratamento de erros
  btSerialPort.on("error", (error) => {
    console.error("Erro:", error);
  });
});

// Desconectando
process.on("SIGINT", () => {
  btSerialPort.close();
  console.log("Conexão encerrada.");
  process.exit();
});
