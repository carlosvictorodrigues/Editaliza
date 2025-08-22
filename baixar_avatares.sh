#!/bin/bash

# Script para baixar e organizar os avatares para o Editaliza

# Define o diretório base para os avatares
BASE_DIR="images/avatars"

echo "🚀 Iniciando o download da biblioteca de avatares..."

# --- Criação dos Diretórios ---
echo "- Criando estrutura de pastas em $BASE_DIR..."
mkdir -p "$BASE_DIR/adventurer"
mkdir -p "$BASE_DIR/pixel-art"
mkdir -p "$BASE_DIR/bots"
mkdir -p "$BASE_DIR/miniavs"

# --- Categoria: Aventureiro (Geral) ---
echo "- Baixando avatares de Aventureiros..."
curl -s -o "$BASE_DIR/adventurer/avatar1.svg" "https://api.dicebear.com/8.x/adventurer/svg?seed=Mittens"
curl -s -o "$BASE_DIR/adventurer/avatar2.svg" "https://api.dicebear.com/8.x/adventurer/svg?seed=Leo"
curl -s -o "$BASE_DIR/adventurer/avatar3.svg" "https://api.dicebear.com/8.x/adventurer/svg?seed=Loki"
curl -s -o "$BASE_DIR/adventurer/avatar4.svg" "https://api.dicebear.com/8.x/adventurer/svg?seed=Max"
curl -s -o "$BASE_DIR/adventurer/avatar5.svg" "https://api.dicebear.com/8.x/adventurer/svg?seed=Mimi"
curl -s -o "$BASE_DIR/adventurer/avatar6.svg" "https://api.dicebear.com/8.x/adventurer/svg?seed=Missy"

# --- Categoria: Pixel Art (Cultura Pop) ---
echo "- Baixando avatares Pixel Art (Cultura Pop)..."
curl -s -o "$BASE_DIR/pixel-art/pixel1.svg" "https://api.dicebear.com/8.x/pixel-art/svg?seed=Mario"
curl -s -o "$BASE_DIR/pixel-art/pixel2.svg" "https://api.dicebear.com/8.x/pixel-art/svg?seed=Luigi"
curl -s -o "$BASE_DIR/pixel-art/pixel3.svg" "https://api.dicebear.com/8.x/pixel-art/svg?seed=Zelda"
curl -s -o "$BASE_DIR/pixel-art/pixel4.svg" "https://api.dicebear.com/8.x/pixel-art/svg?seed=Link"
curl -s -o "$BASE_DIR/pixel-art/pixel5.svg" "https://api.dicebear.com/8.x/pixel-art/svg?seed=Samus"
curl -s -o "$BASE_DIR/pixel-art/pixel6.svg" "https://api.dicebear.com/8.x/pixel-art/svg?seed=MegaMan"

# --- Categoria: Bots (Tecnologia) ---
echo "- Baixando avatares de Bots (Tecnologia)..."
curl -s -o "$BASE_DIR/bots/bot1.svg" "https://api.dicebear.com/8.x/bottts/svg?seed=R2D2"
curl -s -o "$BASE_DIR/bots/bot2.svg" "https://api.dicebear.com/8.x/bottts/svg?seed=C3PO"
curl -s -o "$BASE_DIR/bots/bot3.svg" "https://api.dicebear.com/8.x/bottts/svg?seed=WallE"
curl -s -o "$BASE_DIR/bots/bot4.svg" "https://api.dicebear.com/8.x/bottts/svg?seed=Bender"
curl -s -o "$BASE_DIR/bots/bot5.svg" "https://api.dicebear.com/8.x/bottts/svg?seed=Optimus"
curl -s -o "$BASE_DIR/bots/bot6.svg" "https://api.dicebear.com/8.x/bottts/svg?seed=Hal9000"

# --- Categoria: Miniavs (Minimalista) ---
echo "- Baixando avatares Minimalistas..."
curl -s -o "$BASE_DIR/miniavs/miniav1.svg" "https://api.dicebear.com/8.x/miniavs/svg?seed=Neo"
curl -s -o "$BASE_DIR/miniavs/miniav2.svg" "https://api.dicebear.com/8.x/miniavs/svg?seed=Trinity"
curl -s -o "$BASE_DIR/miniavs/miniav3.svg" "https://api.dicebear.com/8.x/miniavs/svg?seed=Morpheus"
curl -s -o "$BASE_DIR/miniavs/miniav4.svg" "https://api.dicebear.com/8.x/miniavs/svg?seed=Sherlock"
curl -s -o "$BASE_DIR/miniavs/miniav5.svg" "https://api.dicebear.com/8.x/miniavs/svg?seed=Watson"
curl -s -o "$BASE_DIR/miniavs/miniav6.svg" "https://api.dicebear.com/8.x/miniavs/svg?seed=Bond"

echo "✅ Download concluído! Os avatares estão prontos em '$BASE_DIR'"