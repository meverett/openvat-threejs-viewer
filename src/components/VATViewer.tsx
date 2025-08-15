'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import Scene from './Scene';

interface VATParams {
  minValues: THREE.Vector3;
  maxValues: THREE.Vector3;
  FrameCount: number;
  Y_resolution: number;
}

interface VATViewerProps {
  // Add props as needed
}

const VATViewer: React.FC<VATViewerProps> = () => {
  const [vatTexture, setVatTexture] = useState<THREE.Texture | null>(null);
  const [vatNormalTexture, setVatNormalTexture] = useState<THREE.Texture | null>(null);
  const [vatParams, setVatParams] = useState<VATParams | null>(null);
  const [isAnimated, setIsAnimated] = useState(true);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [speed, setSpeed] = useState(24.0);
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [positionTextureFile, setPositionTextureFile] = useState<File | null>(null);
  const [normalTextureFile, setNormalTextureFile] = useState<File | null>(null);
  const [remapInfoFile, setRemapInfoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shouldLoadModel, setShouldLoadModel] = useState(false);

  // Reset shouldLoadModel when files change to prevent immediate loading
  useEffect(() => {
    setShouldLoadModel(false);
  }, [modelFile, positionTextureFile, normalTextureFile, remapInfoFile]);

  // Convert from useCallback to regular async functions
  const loadVATTextureFromFile = async (file: File): Promise<THREE.Texture> => {
    return new Promise((resolve, reject) => {
      const loader = new EXRLoader();
      const textureUrl = URL.createObjectURL(file);
      
      loader.load(
        textureUrl,
        (texture) => {
          URL.revokeObjectURL(textureUrl);
          texture.wrapS = THREE.ClampToEdgeWrapping;
          texture.wrapT = THREE.ClampToEdgeWrapping;
          resolve(texture);
        },
        (progress) => {
          console.log('Loading VAT texture progress:', (progress.loaded / progress.total * 100) + '%');
        },
        (error) => {
          URL.revokeObjectURL(textureUrl);
          reject(error);
        }
      );
    });
  };

  const loadVATNormalTextureFromFile = async (file: File): Promise<THREE.Texture> => {
    return new Promise((resolve, reject) => {
      const loader = new EXRLoader();
      const textureUrl = URL.createObjectURL(file);
      
      loader.load(
        textureUrl,
        (texture) => {
          URL.revokeObjectURL(textureUrl);
          texture.wrapS = THREE.ClampToEdgeWrapping;
          texture.wrapT = THREE.ClampToEdgeWrapping;
          resolve(texture);
        },
        (progress) => {
          console.log('Loading VAT normal texture progress:', (progress.loaded / progress.total * 100) + '%');
        },
        (error) => {
          URL.revokeObjectURL(textureUrl);
          reject(error);
        }
      );
    });
  };

  const loadVATRemapInfoFromFile = async (file: File, texture?: THREE.Texture): Promise<void> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const remapInfo = JSON.parse(event.target?.result as string);
          
          let yResolution = 512.0;
          if (texture && texture.image) {
            yResolution = texture.image.height;
            console.log('Y resolution extracted from texture:', yResolution);
          } else {
            console.log('Using default Y resolution:', yResolution);
          }

          setVatParams({
            Y_resolution: yResolution,
            FrameCount: remapInfo['os-remap']?.Frames ?? 60,
            minValues: new THREE.Vector3(
              remapInfo['os-remap']?.Min?.[0] ?? -1.0,
              remapInfo['os-remap']?.Min?.[1] ?? -1.0,
              remapInfo['os-remap']?.Min?.[2] ?? -1.0
            ),
            maxValues: new THREE.Vector3(
              remapInfo['os-remap']?.Max?.[0] ?? 1.0,
              remapInfo['os-remap']?.Max?.[1] ?? 1.0,
              remapInfo['os-remap']?.Max?.[2] ?? 1.0
            )
          });
          resolve();
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  };

  const handleLoadModel = async () => {
    if (!modelFile || !positionTextureFile || !remapInfoFile) {
      setError('Please select all required files');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Load position texture first
      const texture = await loadVATTextureFromFile(positionTextureFile);
      setVatTexture(texture);
      
      // Load normal texture if provided (optional)
      if (normalTextureFile) {
        const normalTexture = await loadVATNormalTextureFromFile(normalTextureFile);
        setVatNormalTexture(normalTexture);
      }
      
      // Load remap info with the loaded texture
      await loadVATRemapInfoFromFile(remapInfoFile, texture);
      
      // Signal that the model should now be loaded
      setShouldLoadModel(true);
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading model:', error);
      setError(error instanceof Error ? error.message : 'Failed to load model');
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-screen">
      <Canvas
        camera={{ position: [0, 5, 10], fov: 75 }}
        shadows
        gl={{ antialias: true }}
      >
        <Scene 
          vatTexture={vatTexture}
          vatNormalTexture={vatNormalTexture}
          vatParams={vatParams}
          isAnimated={isAnimated}
          currentFrame={currentFrame}
          speed={speed}
          modelFile={modelFile}
          shouldLoadModel={shouldLoadModel}
          loading={loading}
          error={error}
        />
      </Canvas>
      
      {/* Loading and Error Overlays */}
      {loading && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white text-lg z-20 bg-black/50 px-6 py-3 rounded-lg">
          Loading model...
        </div>
      )}
      
      {error && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-red-400 text-center z-20 bg-black/80 px-6 py-4 rounded-lg max-w-md">
          <h3 className="text-lg font-semibold mb-2">Error Loading Model</h3>
          <p className="text-sm">{error}</p>
        </div>
      )}
      
      {/* Controls Overlay */}
      <div className="absolute top-4 right-4 z-10 space-y-4">
        {/* VAT Controls */}
        <div className="bg-black/80 text-white p-4 rounded-lg min-w-[250px]">
          <h4 className="text-lg font-semibold mb-3">VAT Controls</h4>
          
          <div className="space-y-2 mb-3 p-2 bg-white/10 rounded">
            <div>Position Texture: <span className="text-green-400">Loaded ✓</span></div>
            <div>Normal Texture: <span className="text-green-400">Loaded ✓</span></div>
            <div>Dimensions: <span>{vatTexture?.image ? `${vatTexture.image.width} × ${vatTexture.image.height}` : '-'}</span></div>
          </div>
          
          {vatParams && (
            <div className="space-y-2 mb-3 p-2 bg-white/10 rounded">
              <div>Min Values: <span>({vatParams.minValues.x.toFixed(2)}, {vatParams.minValues.y.toFixed(2)}, {vatParams.minValues.z.toFixed(2)})</span></div>
              <div>Max Values: <span>({vatParams.maxValues.x.toFixed(2)}, {vatParams.maxValues.y.toFixed(2)}, {vatParams.maxValues.z.toFixed(2)})</span></div>
              <div>Frame Count: <span>{vatParams.FrameCount}</span></div>
              <div>Y Resolution: <span>{vatParams.Y_resolution}</span></div>
            </div>
          )}
          
          <div className="space-y-3">
            <label className="flex items-center space-x-2">
              <input 
                type="checkbox" 
                checked={isAnimated}
                onChange={(e) => setIsAnimated(e.target.checked)}
                className="rounded"
              />
              <span>Animated</span>
            </label>
            
            <div>
              <label className="block text-sm mb-1">
                Frame: <span>{currentFrame}</span>
              </label>
              <input 
                type="range" 
                min={0} 
                max={vatParams?.FrameCount ? vatParams.FrameCount - 1 : 59} 
                value={currentFrame}
                onChange={(e) => setCurrentFrame(parseInt(e.target.value))}
                className="w-full"
              />
            </div>
            
            <div>
              <label className="block text-sm mb-1">
                Speed: <span>{speed.toFixed(1)}</span>
              </label>
              <input 
                type="range" 
                min={0.1} 
                max={60.0} 
                step={0.1} 
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
        </div>
        
        {/* File Upload Controls */}
        <div className="bg-black text-white p-4 rounded-lg min-w-[250px]">
          <h4 className="text-lg font-semibold mb-3">VAT Asset Files</h4>
          
          <div className="space-y-3">
            <div>
              <label className="block text-sm mb-1">Model File:</label>
              <input 
                type="file" 
                accept=".glb"
                onChange={(e) => setModelFile(e.target.files?.[0] || null)}
                className="w-full text-white bg-transparent border border-white/30 rounded p-1"
              />
            </div>
            
            <div>
              <label className="block text-sm mb-1">Position Texture File:</label>
              <input 
                type="file" 
                accept=".exr"
                onChange={(e) => setPositionTextureFile(e.target.files?.[0] || null)}
                className="w-full text-white bg-transparent border border-white/30 rounded p-1"
              />
            </div>
            
            <div>
              <label className="block text-sm mb-1">Normals Texture File:</label>
              <input 
                type="file" 
                accept=".exr"
                onChange={(e) => setNormalTextureFile(e.target.files?.[0] || null)}
                className="w-full text-white bg-transparent border border-white/30 rounded p-1"
              />
            </div>
            
            <div>
              <label className="block text-sm mb-1">Remap Info File:</label>
              <input 
                type="file" 
                accept=".json"
                onChange={(e) => setRemapInfoFile(e.target.files?.[0] || null)}
                className="w-full text-white bg-transparent border border-white/30 rounded p-1"
              />
            </div>
            
            <button 
              onClick={handleLoadModel}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded transition-colors"
            >
              Load Model
            </button>
          </div>
        </div>
      </div>
      
      {/* Info Panel */}
      <div className="absolute top-4 left-4 z-10 bg-black/80 text-white p-4 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">OpenVAT Viewer</h3>
        <p className="text-sm">Mouse: Rotate camera</p>
        <p className="text-sm">Scroll: Zoom in/out</p>
        <p className="text-sm">Right click + drag: Pan</p>
      </div>
    </div>
  );
};

export default VATViewer;
