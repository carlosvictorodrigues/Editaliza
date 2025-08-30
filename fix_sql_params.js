/**
 * Script para converter queries SQL de SQLite (?) para PostgreSQL ($1, $2, etc)
 */

const fs = require('fs');
const path = require('path');

function convertSQLiteToPostgreSQL(content) {
    // Dividir em linhas para processar linha por linha
    const lines = content.split('\n');
    let result = [];
    let paramCounter = 0;
    let inQuery = false;
    
    for (let line of lines) {
        // Detectar início de query SQL
        if (line.includes('dbGet(`') || line.includes('dbAll(`') || line.includes('dbRun(`') || 
            line.includes('dbGet(\'') || line.includes('dbAll(\'') || line.includes('dbRun(\'') ||
            line.includes('dbGet("') || line.includes('dbAll("') || line.includes('dbRun("')) {
            inQuery = true;
            paramCounter = 0;
        }
        
        // Se estamos dentro de uma query, substituir ? por $n
        if (inQuery) {
            // Substituir cada ? por $n incrementando o contador
            let processedLine = line;
            while (processedLine.includes(' ?') || processedLine.includes('= ?') || processedLine.includes('=?')) {
                paramCounter++;
                // Substituir o primeiro ? encontrado
                processedLine = processedLine.replace(/(\s|=)\?/, `$1$${paramCounter}`);
            }
            result.push(processedLine);
        } else {
            result.push(line);
        }
        
        // Detectar fim de query (quando encontramos o array de parâmetros)
        if (inQuery && (line.includes('], [') || line.includes(']);') || line.includes('])'))) {
            inQuery = false;
            paramCounter = 0;
        }
    }
    
    return result.join('\n');
}

// Ler o arquivo
const filePath = path.join(__dirname, 'src', 'controllers', 'statistics.controller.js');
console.log('📖 Lendo arquivo:', filePath);

const content = fs.readFileSync(filePath, 'utf-8');

// Converter
console.log('🔄 Convertendo queries SQL...');
const converted = convertSQLiteToPostgreSQL(content);

// Salvar
fs.writeFileSync(filePath, converted, 'utf-8');
console.log('✅ Arquivo atualizado com sucesso!');

// Contar quantas conversões foram feitas
const originalCount = (content.match(/\?/g) || []).length;
const convertedCount = (converted.match(/\$\d+/g) || []).length;
console.log(`📊 Convertidos ${convertedCount} parâmetros SQL`);