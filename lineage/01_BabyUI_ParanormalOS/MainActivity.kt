package com.paranormal.ai

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            SageTheme {
                Scaffold(modifier = Modifier.fillMaxSize()) { innerPadding ->
                    SageApp(modifier = Modifier.padding(innerPadding))
                }
            }
        }
    }
}

@Composable
fun SageApp(modifier: Modifier = Modifier) {
    Box(
        modifier = modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = "Sage — Paranormal AI",
            style = MaterialTheme.typography.headlineMedium
        )
    }
}

@Composable
fun SageTheme(content: @Composable () -> Unit) {
    MaterialTheme(content = content)
}

@Preview(showBackground = true)
@Composable
fun DefaultPreview() {
    SageTheme {
        Surface {
            SageApp()
        }
    }
}
