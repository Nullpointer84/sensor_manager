package com.sensormanager.common

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows

/**
 * Pins the input validation on [loadJsonSnapshot]. The function's whole
 * defense against path traversal is the name whitelist; this test fails if
 * the whitelist is ever loosened to accept characters that could escape the
 * `data/` prefix or reach an unintended classpath resource.
 */
class JsonSnapshotTest {

    private val objectMapper = jacksonObjectMapper()

    @Test
    fun `rejects names containing path separators or dot segments`() {
        val hostile = listOf(
            "../etc/passwd",
            "../../application",
            "data/locations",
            "locations.json",
            "foo/bar",
            "..",
            ".",
        )
        for (name in hostile) {
            val ex = assertThrows<IllegalArgumentException> {
                loadJsonSnapshot<Map<String, Any>>(objectMapper, name)
            }
            assertTrue(
                ex.message?.contains("Invalid snapshot name") == true,
                "Expected validation error for '$name', got: ${ex.message}",
            )
        }
    }

    @Test
    fun `rejects uppercase, empty, and whitespace names`() {
        val invalid = listOf("", "Locations", "FOO", "name with space", "\t", "loc\nations")
        for (name in invalid) {
            assertThrows<IllegalArgumentException>("Expected '$name' to be rejected") {
                loadJsonSnapshot<Map<String, Any>>(objectMapper, name)
            }
        }
    }

    @Test
    fun `accepts a valid name and loads the actual snapshot`() {
        // Smoke test: 'stats' is a real snapshot shipped with the app. The
        // shape itself is pinned by LandingContractTest; here we just prove
        // the validator lets a well-formed name through and the file loads.
        val result = loadJsonSnapshot<Map<String, Any>>(objectMapper, "stats")
        assertNotNull(result)
        assertTrue(result.isNotEmpty())
    }

    @Test
    fun `surfaces missing snapshots with a clear message instead of a vague IO error`() {
        val ex = assertThrows<IllegalStateException> {
            loadJsonSnapshot<Map<String, Any>>(objectMapper, "definitely-not-a-real-snapshot")
        }
        assertTrue(
            ex.message?.contains("Missing required snapshot") == true,
            "Expected missing-snapshot error, got: ${ex.message}",
        )
        assertTrue(
            ex.message?.contains("definitely-not-a-real-snapshot") == true,
            "Expected the snapshot name in the error, got: ${ex.message}",
        )
    }
}
