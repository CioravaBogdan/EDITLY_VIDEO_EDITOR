FROM node:18-bookworm

# Install runtime + build deps for node-canvas/fabric/headless-gl and tools
RUN apt-get update -y \
  && apt-get -y install --no-install-recommends \
    dumb-init xvfb xauth curl ca-certificates \
    # Runtime libs
    libcairo2 libpango1.0 libgif7 librsvg2-2 libfribidi0 \
    libfreetype6 libjpeg62-turbo libpixman-1-0 libharfbuzz0b \
    libgl1 libglib2.0-0 libgdk-pixbuf-2.0-0 \
    # Build toolchain + headers (for npm rebuild)
    build-essential python3 pkg-config \
    libcairo2-dev libpango1.0-dev libjpeg62-turbo-dev libgif-dev librsvg2-dev \
    libfreetype6-dev libharfbuzz-dev libpixman-1-dev \
    libgl1-mesa-dev libxi-dev libxext-dev \
  && rm -rf /var/lib/apt/lists/*

# Install static FFmpeg build
WORKDIR /tmp
RUN curl -L "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-gpl-shared.tar.xz" -o ffmpeg.tar.xz \
  && mkdir -p /usr/local/ffmpeg \
  && tar -xJf ffmpeg.tar.xz --strip-components=1 -C /usr/local/ffmpeg \
  && echo "/usr/local/ffmpeg/lib" > /etc/ld.so.conf.d/ffmpeg.conf \
  && ldconfig \
  && rm -f ffmpeg.tar.xz

ENV PATH="/usr/local/ffmpeg/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
ENV LD_LIBRARY_PATH="/usr/local/ffmpeg/lib:${LD_LIBRARY_PATH}"

WORKDIR /app

# Pre-copy package manifest and install production deps
COPY package.json /app/package.json

# Ensure node-gyp uses python3 for build
ENV PYTHON=/usr/bin/python3 \
  npm_config_python=/usr/bin/python3 \
  npm_config_build_from_source=true

RUN npm install --omit=dev --no-audit --no-fund

# Copy repository (dist, assets, docs)
COPY . /app

# Create runtime directories
RUN mkdir -p /app/uploads /app/files /app/temp /outputs

# Ensure node-gyp uses python3 and rebuild native modules for Linux
RUN (npm rebuild --unsafe-perm --build-from-source || true) \
  && (npm rebuild canvas --unsafe-perm --build-from-source || true) \
  && (npm rebuild gl --unsafe-perm --build-from-source || true)

ENV PORT=3001 \
    UPLOAD_DIR=/app/uploads \
    FILES_DIR=/app/files

EXPOSE 3001

# Run with dumb-init and xvfb-run (auto-allocates display, avoids stale locks)
CMD ["/usr/bin/dumb-init", "xvfb-run", "-a", "-s", "-screen 0 1280x1024x24", "node", "dist/api-server.js"]
