import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { X } from 'lucide-react';

interface Ambulance3DViewerProps {
  ambulance: {
    id: string;
    name: string;
    type: string;
    type_label?: string;
    model?: string;
    driver?: string;
    equipment?: string[];
    status?: string;
    license_plate?: string;
  };
  onClose: () => void;
}

export const Ambulance3DViewer: React.FC<Ambulance3DViewerProps> = ({ ambulance, onClose }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth || 580;
    const height = 360;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1d);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(4, 2.5, 5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mountRef.current.appendChild(renderer.domElement);

    // 2. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight.position.set(6, 8, 5);
    scene.add(dirLight);

    const blueRimLight = new THREE.PointLight(0x00d4ff, 1.2, 10);
    blueRimLight.position.set(-4, 3, -3);
    scene.add(blueRimLight);

    // 3. Ambulance Geometry Group
    const ambulanceGroup = new THREE.Group();

    const mat = (color: number, emissive = 0x000000, rough = 0.3) =>
      new THREE.MeshStandardMaterial({
        color,
        emissive,
        roughness: rough,
        metalness: 0.25,
      });

    // Body
    const bodyGeo = new THREE.BoxGeometry(2.8, 1.2, 1.4);
    const bodyMesh = new THREE.Mesh(bodyGeo, mat(0xf8fafc));
    bodyMesh.position.set(0, 0.65, 0);
    ambulanceGroup.add(bodyMesh);

    // Front Cab
    const cabGeo = new THREE.BoxGeometry(1.0, 0.9, 1.38);
    const cabColor = ambulance.type === 'MICU' ? 0x9333ea : ambulance.type === 'ALS' ? 0xdc2626 : 0x2563eb;
    const cabMesh = new THREE.Mesh(cabGeo, mat(cabColor));
    cabMesh.position.set(-1.1, 0.52, 0);
    ambulanceGroup.add(cabMesh);

    // Windshield
    const windGeo = new THREE.BoxGeometry(0.06, 0.6, 1.1);
    const windMesh = new THREE.Mesh(
      windGeo,
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.1, transparent: true, opacity: 0.75 })
    );
    windMesh.position.set(-1.62, 0.55, 0);
    ambulanceGroup.add(windMesh);

    // Dynamic Red/Reflective Stripe
    const stripeGeo = new THREE.BoxGeometry(2.82, 0.22, 1.42);
    const stripeMesh = new THREE.Mesh(stripeGeo, mat(0xef4444));
    stripeMesh.position.set(0, 0.95, 0);
    ambulanceGroup.add(stripeMesh);

    // Roof Raised Unit (Ventilation & Life Support)
    const roofGeo = new THREE.BoxGeometry(1.9, 0.38, 1.3);
    const roofMesh = new THREE.Mesh(roofGeo, mat(0xf1f5f9));
    roofMesh.position.set(0.35, 1.35, 0);
    ambulanceGroup.add(roofMesh);

    // Wheels (4 units)
    const wheelMat = mat(0x1e293b, 0x000000, 0.8);
    const rimMat = mat(0x94a3b8, 0x000000, 0.2);
    const wheelPositions = [
      [-0.8, -0.15, 0.75],
      [0.8, -0.15, 0.75],
      [-0.8, -0.15, -0.75],
      [0.8, -0.15, -0.75],
    ];

    wheelPositions.forEach(([x, y, z]) => {
      const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.2, 18);
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.position.set(x, y, z);
      wheel.rotation.x = Math.PI / 2;
      ambulanceGroup.add(wheel);

      const rimGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.22, 10);
      const rim = new THREE.Mesh(rimGeo, rimMat);
      rim.position.set(x, y, z);
      rim.rotation.x = Math.PI / 2;
      ambulanceGroup.add(rim);
    });

    // Emergency Roof Beacons
    const beaconLeftMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xef4444,
      emissiveIntensity: 1.5,
    });
    const beaconRightMat = new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
      emissive: 0x3b82f6,
      emissiveIntensity: 1.5,
    });

    const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.35), beaconLeftMat);
    b1.position.set(-0.25, 1.6, 0.35);
    ambulanceGroup.add(b1);

    const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.35), beaconRightMat);
    b2.position.set(-0.25, 1.6, -0.35);
    ambulanceGroup.add(b2);

    // Cross Emblem
    const cross1 = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.14, 0.04), mat(0xdc2626));
    cross1.position.set(0.5, 0.68, 0.71);
    ambulanceGroup.add(cross1);
    const cross2 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.48, 0.04), mat(0xdc2626));
    cross2.position.set(0.5, 0.68, 0.71);
    ambulanceGroup.add(cross2);

    // Grid Floor
    const grid = new THREE.GridHelper(10, 20, 0x1e293b, 0x0f172a);
    grid.position.y = -0.3;
    scene.add(grid);

    scene.add(ambulanceGroup);

    // 4. Interactive Drag & Zoom Controls
    let isDragging = false;
    let prevX = 0;
    let prevY = 0;
    let rotY = 0.8;
    let rotX = 0.2;
    let zoom = 5.2;

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevX = e.clientX;
      prevY = e.clientY;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - prevX;
      const dy = e.clientY - prevY;
      rotY += dx * 0.01;
      rotX = Math.max(-0.2, Math.min(0.8, rotX + dy * 0.006));
      prevX = e.clientX;
      prevY = e.clientY;
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoom = Math.max(3.0, Math.min(9.0, zoom + e.deltaY * 0.005));
    };

    const el = mountRef.current;
    el.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    el.addEventListener('wheel', onWheel, { passive: false });

    // 5. Animation Loop
    let t = 0;
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      t += 0.04;

      if (!isDragging) {
        rotY += 0.004; // Gentle auto-rotation
      }

      ambulanceGroup.rotation.y = rotY;

      // Strobe emergency light flashing
      const flash = Math.sin(t * 8);
      beaconLeftMat.emissiveIntensity = flash > 0 ? 2.5 : 0.2;
      beaconRightMat.emissiveIntensity = flash < 0 ? 2.5 : 0.2;

      camera.position.x = Math.sin(rotY * 0) * zoom + 1.5;
      camera.position.y = Math.sin(rotX) * zoom + 1.8;
      camera.position.z = Math.cos(rotX) * zoom;
      camera.lookAt(0, 0.6, 0);

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      el.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      el.removeEventListener('wheel', onWheel);
      if (renderer.domElement && el.contains(renderer.domElement)) {
        el.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [ambulance]);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        style={{
          backgroundColor: '#0f172a',
          color: '#f8fafc',
          borderRadius: '16px',
          border: '1px solid rgba(148, 163, 184, 0.2)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          maxWidth: '680px',
          width: '100%',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid rgba(148, 163, 184, 0.15)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#1e293b',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.2rem' }}>🚑</span>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#38bdf8' }}>
                {ambulance.name} ({ambulance.type})
              </h3>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  backgroundColor: 'rgba(56, 189, 248, 0.15)',
                  color: '#38bdf8',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                }}
              >
                {ambulance.status || 'AVAILABLE'}
              </span>
            </div>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '3px 0 0 0' }}>
              {ambulance.model || 'Force Traveller Medical'} · Plate: {ambulance.license_plate || 'MH-12-CD-5678'} · Driver: {ambulance.driver || 'Assigned'}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* 3D Canvas Viewport */}
        <div style={{ position: 'relative', width: '100%', height: '360px', backgroundColor: '#0a0f1d' }}>
          <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
          <div
            style={{
              position: 'absolute',
              bottom: '12px',
              left: '16px',
              fontSize: '0.72rem',
              color: '#64748b',
              pointerEvents: 'none',
              backgroundColor: 'rgba(15, 23, 42, 0.7)',
              padding: '4px 10px',
              borderRadius: '6px',
            }}
          >
            🖱️ Drag to rotate 360° · Scroll wheel to zoom
          </div>
        </div>

        {/* Equipment & Specification Matrix */}
        <div style={{ padding: '16px 20px', backgroundColor: '#0f172a' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '8px' }}>
            📦 Onboard Medical & Resuscitation Equipment:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {(ambulance.equipment && ambulance.equipment.length > 0
              ? ambulance.equipment
              : [
                  'Cardiac Monitor / Defibrillator',
                  'Transport Ventilator',
                  'IV Infusion Pump',
                  'Oxygen Cylinder (Large)',
                  'Suction Unit',
                  'Drug Box (ALS Medications)',
                  'Intubation Kit',
                  'Pulse Oximeter',
                ]
            ).map((eq, i) => (
              <span
                key={i}
                style={{
                  fontSize: '0.72rem',
                  backgroundColor: 'rgba(30, 41, 59, 0.8)',
                  color: '#e2e8f0',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                }}
              >
                ✓ {eq}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
