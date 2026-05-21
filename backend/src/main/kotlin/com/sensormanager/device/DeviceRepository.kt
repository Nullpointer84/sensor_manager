package com.sensormanager.device

interface DeviceRepository {
    fun findAll(): List<Device>
}
