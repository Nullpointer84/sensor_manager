package com.sensormanager.location

/**
 * Read-only contract for locations. Implementations are swappable
 * (currently a static JSON snapshot; later a real database). Callers
 * up the stack must not depend on anything beyond this interface.
 */
interface LocationRepository {
    fun findAll(): List<Location>
}
