#!/bin/bash

# Exit on error
set -e

# Check platform
platform=$(uname)

if [[ "$platform" == "Darwin" ]]; then
    echo "Running on macOS. Note that the AppImage created will only work on Linux systems."
    if ! command -v docker &> /dev/null; then
        echo "Docker Desktop for Mac is not installed. Please install it from https://www.docker.com/products/docker-desktop"
        exit 1
    fi
elif [[ "$platform" == "Linux" ]]; then
    echo "Running on Linux. Proceeding with AppImage creation..."
else
    echo "This script is intended to run on macOS or Linux. Current platform: $platform"
    exit 1
fi

# Enable BuildKit
export DOCKER_BUILDKIT=1

BUILD_IMAGE_NAME="orbit-appimage-builder"

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "Docker is not running. Please start Docker first."
    exit 1
fi

# Check and install Buildx if needed
if ! docker buildx version >/dev/null 2>&1; then
    echo "Installing Docker Buildx..."
    mkdir -p ~/.docker/cli-plugins/
    curl -SL https://github.com/docker/buildx/releases/download/v0.13.1/buildx-v0.13.1.linux-amd64 -o ~/.docker/cli-plugins/docker-buildx
    chmod +x ~/.docker/cli-plugins/docker-buildx
fi

# Download appimagetool if not present
if [ ! -f "appimagetool" ]; then
    echo "Downloading appimagetool..."
    wget -O appimagetool "https://github.com/AppImage/AppImageKit/releases/download/continuous/appimagetool-x86_64.AppImage"
    chmod +x appimagetool
fi

# Delete any existing AppImage to avoid bloating the build
rm -f Orbit-x86_64.AppImage

# Create build Dockerfile
echo "Creating build Dockerfile..."
cat > Dockerfile.build << 'EOF'
# syntax=docker/dockerfile:1
FROM ubuntu:20.04

# Install required dependencies
RUN apt-get update && apt-get install -y \
    libfuse2 \
    libglib2.0-0 \
    libgtk-3-0 \
    libx11-xcb1 \
    libxss1 \
    libxtst6 \
    libnss3 \
    libasound2 \
    libdrm2 \
    libgbm1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
EOF

# Create .dockerignore file
echo "Creating .dockerignore file..."
cat > .dockerignore << EOF
Dockerfile.build
.dockerignore
.git
.gitignore
.DS_Store
*~
*.swp
*.swo
*.tmp
*.bak
*.log
*.err
node_modules/
venv/
*.egg-info/
*.tox/
dist/
EOF

# Build Docker image without cache
echo "Building Docker image (no cache)..."
docker build --no-cache -t "$BUILD_IMAGE_NAME" -f Dockerfile.build .

# Create AppImage using local appimagetool
echo "Creating AppImage..."
docker run --rm --privileged -v "$(pwd):/app" "$BUILD_IMAGE_NAME" bash -c '
cd /app && \
rm -rf OrbitApp.AppDir && \
mkdir -p OrbitApp.AppDir/usr/bin OrbitApp.AppDir/usr/lib OrbitApp.AppDir/usr/share/applications && \
find . -maxdepth 1 ! -name OrbitApp.AppDir ! -name "." ! -name ".." -exec cp -r {} OrbitApp.AppDir/usr/bin/ \; && \
(cp orbit-editor.png OrbitApp.AppDir/ 2>/dev/null || cp orbit.png OrbitApp.AppDir/ 2>/dev/null || cp void.png OrbitApp.AppDir/) && \
echo "[Desktop Entry]" > OrbitApp.AppDir/orbit.desktop && \
echo "Name=Orbit" >> OrbitApp.AppDir/orbit.desktop && \
echo "Comment=Open source AI code editor." >> OrbitApp.AppDir/orbit.desktop && \
echo "GenericName=Text Editor" >> OrbitApp.AppDir/orbit.desktop && \
echo "Exec=orbit %F" >> OrbitApp.AppDir/orbit.desktop && \
echo "Icon=orbit-editor" >> OrbitApp.AppDir/orbit.desktop && \
echo "Type=Application" >> OrbitApp.AppDir/orbit.desktop && \
echo "StartupNotify=false" >> OrbitApp.AppDir/orbit.desktop && \
echo "StartupWMClass=Orbit" >> OrbitApp.AppDir/orbit.desktop && \
echo "Categories=TextEditor;Development;IDE;" >> OrbitApp.AppDir/orbit.desktop && \
echo "MimeType=application/x-orbit-workspace;" >> OrbitApp.AppDir/orbit.desktop && \
echo "Keywords=orbit;" >> OrbitApp.AppDir/orbit.desktop && \
echo "Actions=new-empty-window;" >> OrbitApp.AppDir/orbit.desktop && \
echo "[Desktop Action new-empty-window]" >> OrbitApp.AppDir/orbit.desktop && \
echo "Name=New Empty Window" >> OrbitApp.AppDir/orbit.desktop && \
echo "Name[de]=Neues leeres Fenster" >> OrbitApp.AppDir/orbit.desktop && \
echo "Name[es]=Nueva ventana vacía" >> OrbitApp.AppDir/orbit.desktop && \
echo "Name[fr]=Nouvelle fenêtre vide" >> OrbitApp.AppDir/orbit.desktop && \
echo "Name[it]=Nuova finestra vuota" >> OrbitApp.AppDir/orbit.desktop && \
echo "Name[ja]=新しい空のウィンドウ" >> OrbitApp.AppDir/orbit.desktop && \
echo "Name[ko]=새 빈 창" >> OrbitApp.AppDir/orbit.desktop && \
echo "Name[ru]=Новое пустое окно" >> OrbitApp.AppDir/orbit.desktop && \
echo "Name[zh_CN]=新建空窗口" >> OrbitApp.AppDir/orbit.desktop && \
echo "Name[zh_TW]=開新空視窗" >> OrbitApp.AppDir/orbit.desktop && \
echo "Exec=orbit --new-window %F" >> OrbitApp.AppDir/orbit.desktop && \
echo "Icon=orbit-editor" >> OrbitApp.AppDir/orbit.desktop && \
chmod +x OrbitApp.AppDir/orbit.desktop && \
cp OrbitApp.AppDir/orbit.desktop OrbitApp.AppDir/usr/share/applications/ && \
echo "[Desktop Entry]" > OrbitApp.AppDir/orbit-url-handler.desktop && \
echo "Name=Orbit - URL Handler" > OrbitApp.AppDir/orbit-url-handler.desktop && \
echo "Comment=Open source AI code editor." > OrbitApp.AppDir/orbit-url-handler.desktop && \
echo "GenericName=Text Editor" > OrbitApp.AppDir/orbit-url-handler.desktop && \
echo "Exec=orbit --open-url %U" > OrbitApp.AppDir/orbit-url-handler.desktop && \
echo "Icon=orbit-editor" > OrbitApp.AppDir/orbit-url-handler.desktop && \
echo "Type=Application" > OrbitApp.AppDir/orbit-url-handler.desktop && \
echo "NoDisplay=true" > OrbitApp.AppDir/orbit-url-handler.desktop && \
echo "StartupNotify=true" > OrbitApp.AppDir/orbit-url-handler.desktop && \
echo "Categories=Utility;TextEditor;Development;IDE;" > OrbitApp.AppDir/orbit-url-handler.desktop && \
echo "MimeType=x-scheme-handler/orbit;" > OrbitApp.AppDir/orbit-url-handler.desktop && \
echo "Keywords=orbit;" > OrbitApp.AppDir/orbit-url-handler.desktop && \
chmod +x OrbitApp.AppDir/orbit-url-handler.desktop && \
cp OrbitApp.AppDir/orbit-url-handler.desktop OrbitApp.AppDir/usr/share/applications/ && \
echo "#!/bin/bash" > OrbitApp.AppDir/AppRun && \
echo "HERE=\$(dirname \"\$(readlink -f \"\${0}\")\")" >> OrbitApp.AppDir/AppRun && \
echo "export PATH=\${HERE}/usr/bin:\${PATH}" >> OrbitApp.AppDir/AppRun && \
echo "export LD_LIBRARY_PATH=\${HERE}/usr/lib:\${LD_LIBRARY_PATH}" >> OrbitApp.AppDir/AppRun && \
echo "exec \${HERE}/usr/bin/orbit --no-sandbox \"\$@\"" >> OrbitApp.AppDir/AppRun && \
chmod +x OrbitApp.AppDir/AppRun && \
chmod -R 755 OrbitApp.AppDir && \

# Strip unneeded symbols from the binary to reduce size
strip --strip-unneeded OrbitApp.AppDir/usr/bin/orbit

ls -la OrbitApp.AppDir/ && \
ARCH=x86_64 ./appimagetool -n OrbitApp.AppDir Orbit-x86_64.AppImage
'

# Clean up
rm -rf OrbitApp.AppDir .dockerignore appimagetool

echo "AppImage creation complete! Your AppImage is: Orbit-x86_64.AppImage"
