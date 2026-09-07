// ================================================================
// app/build.gradle.kts
// Paranormal AI — Sage
// All API keys loaded from local.properties (never hardcoded)
// ================================================================

import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.google.devtools.ksp")
    id("org.jetbrains.kotlin.plugin.serialization")
    id("org.jetbrains.kotlin.plugin.compose")
}

// Load local.properties safely — keys never in source control
val localProps = Properties().apply {
    val f = rootProject.file("local.properties")
    if (f.exists()) load(f.inputStream())
}

fun localProp(key: String, default: String = "") =
    localProps.getProperty(key, System.getenv(key) ?: default)

android {
    namespace   = "com.paranormal.ai"
    compileSdk  = 34

    defaultConfig {
        applicationId          = "com.paranormal.ai"
        minSdk                 = 26
        targetSdk              = 34
        versionCode            = 1
        versionName            = "1.0.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        // Inject API keys as BuildConfig fields — accessed in code
        // NEVER log these. NEVER put them in strings.xml.
        buildConfigField("String", "ELEVENLABS_API_KEY",
            "\"${localProp("ELEVENLABS_API_KEY")}\"")
        buildConfigField("String", "ELEVENLABS_VOICE_ID",
            "\"${localProp("ELEVENLABS_VOICE_ID", "pNInz6obpgDQGcFmaJgB")}\"")
        buildConfigField("String", "GOOGLE_TTS_API_KEY",
            "\"${localProp("GOOGLE_TTS_API_KEY")}\"")
        buildConfigField("String", "GEMINI_API_KEY",
            "\"${localProp("GEMINI_API_KEY")}\"")
        buildConfigField("String", "GROK_API_KEY",
            "\"${localProp("GROK_API_KEY")}\"")

        // Room schema export directory
        ksp {
            arg("room.schemaLocation", "$projectDir/schemas")
            arg("room.incremental", "true")
        }
    }

    // ── SIGNING ───────────────────────────────────────────────────
    signingConfigs {
        create("release") {
            val keystoreFile = localProp("KEYSTORE_FILE")
            if (keystoreFile.isNotBlank()) {
                storeFile     = rootProject.file(keystoreFile)
                storePassword = localProp("KEYSTORE_PASSWORD")
                keyAlias      = localProp("KEY_ALIAS", "sage")
                keyPassword   = localProp("KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        debug {
            isDebuggable        = true
            applicationIdSuffix = ".debug"
            versionNameSuffix   = "-debug"
        }
        release {
            isMinifyEnabled   = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
        freeCompilerArgs += listOf(
            "-opt-in=kotlinx.coroutines.ExperimentalCoroutinesApi",
            "-opt-in=androidx.compose.material3.ExperimentalMaterial3Api"
        )
    }

    buildFeatures {
        compose    = true
        viewBinding = true
        buildConfig = true   // Required for BuildConfig API key fields
    }

    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.8"
    }

    packaging {
        resources.excludes += "/META-INF/{AL2.0,LGPL2.1}"
    }
}

dependencies {
    // ── Core ──────────────────────────────────────────────────────
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("com.google.android.material:material:1.11.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.7.0")
    implementation("androidx.lifecycle:lifecycle-service:2.7.0")
    implementation("androidx.activity:activity-compose:1.8.2")

    // ── Compose ───────────────────────────────────────────────────
    val composeBom = platform("androidx.compose:compose-bom:2024.02.00")
    implementation(composeBom)
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.animation:animation")
    implementation("androidx.compose.runtime:runtime")
    implementation("androidx.compose.foundation:foundation")
    debugImplementation("androidx.compose.ui:ui-tooling")

    // ── Coroutines ────────────────────────────────────────────────
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.7.3")

    // ── Room Database ─────────────────────────────────────────────
    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    ksp("androidx.room:room-compiler:2.6.1")

    // ── DataStore ─────────────────────────────────────────────────
    implementation("androidx.datastore:datastore-preferences:1.0.0")

    // ── Kotlin Serialization ──────────────────────────────────────
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.3")

    // ── WorkManager ───────────────────────────────────────────────
    implementation("androidx.work:work-runtime-ktx:2.9.0")

    // ── Navigation ────────────────────────────────────────────────
    implementation("androidx.navigation:navigation-compose:2.7.6")

    // ── Test ──────────────────────────────────────────────────────
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.7.3")
    androidTestImplementation("androidx.test.ext:junit:1.1.5")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.1")
    androidTestImplementation(composeBom)
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}
