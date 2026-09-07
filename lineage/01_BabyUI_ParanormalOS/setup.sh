#!/bin/bash
# ================================================================
# setup.sh — First-time setup for Sage / ParanormalAI
# Run once after cloning. Does not touch secrets.
# ================================================================

echo "🧠 Sage — First-Time Setup"
echo "================================="

# 1. Check Java
if ! command -v java &> /dev/null; then
    echo "❌ Java not found. Install JDK 17: https://adoptium.net"
    exit 1
fi
JAVA_VER=$(java -version 2>&1 | awk -F '"' '/version/ {print $2}' | cut -d'.' -f1)
echo "✅ Java $JAVA_VER found"

# 2. Check Android SDK
if [ -z "$ANDROID_HOME" ]; then
    echo "⚠️  ANDROID_HOME not set. Add to your shell profile:"
    echo "   export ANDROID_HOME=\$HOME/Library/Android/sdk  # macOS"
    echo "   export ANDROID_HOME=\$HOME/Android/Sdk           # Linux"
fi

# 3. Copy local.properties template
if [ ! -f "local.properties" ]; then
    cp local.properties.template local.properties
    echo "✅ Created local.properties — fill in your API keys"
else
    echo "ℹ️  local.properties already exists"
fi

# 4. Generate release keystore
if [ ! -f "keystore/sage-release.jks" ]; then
    echo ""
    echo "🔑 Generating release keystore..."
    mkdir -p keystore
    keytool -genkey -v \
        -keystore keystore/sage-release.jks \
        -keyalg RSA \
        -keysize 2048 \
        -validity 10000 \
        -alias sage \
        -dname "CN=Sage, OU=ParanormalAI, O=ParanormalAI, L=Unknown, S=Unknown, C=US"
    echo "✅ Keystore created at keystore/sage-release.jks"
    echo "   Add passwords to local.properties"
else
    echo "ℹ️  Keystore already exists"
fi

# 5. Make gradlew executable
chmod +x gradlew
echo "✅ gradlew is executable"

# 6. Print GitHub secrets setup for CI
echo ""
echo "📋 GitHub Secrets needed for CI (Settings → Secrets → Actions):"
echo "   ELEVENLABS_API_KEY"
echo "   ELEVENLABS_VOICE_ID  (default: pNInz6obpgDQGcFmaJgB)"
echo "   GOOGLE_TTS_API_KEY"
echo "   GEMINI_API_KEY"
echo "   GROK_API_KEY"
echo "   KEYSTORE_BASE64      (run: base64 -w 0 keystore/sage-release.jks)"
echo "   KEYSTORE_PASSWORD"
echo "   KEY_ALIAS            (default: sage)"
echo "   KEY_PASSWORD"
echo ""
echo "🚀 Ready to build:"
echo "   ./gradlew assembleDebug"
echo "   adb install app/build/outputs/apk/debug/app-debug.apk"
