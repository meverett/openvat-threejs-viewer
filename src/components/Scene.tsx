'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshStandardOpenVATMaterial } from '../threejs/materials/MeshStandardMaterialOpenVAT.js';

interface VATParams {
  minValues: THREE.Vector3;
  maxValues: THREE.Vector3;
  FrameCount: number;
  Y_resolution: number;
  Position?: THREE.Vector3 | null;
}

interface SceneProps {
  vatTexture: THREE.Texture | null;
  vatNormalTexture: THREE.Texture | null;
  vatParams: VATParams | null;
  isAnimated: boolean;
  currentFrame: number;
  speed: number;
  modelFile: File | null;
  shouldLoadModel: boolean;
  loading: boolean;
  error: string | null;
  ambientLightColor: string;
  ambientLightIntensity: number;
  directionalLightColor: string;
  directionalLightIntensity: number;
  pointLightColor: string;
  pointLightIntensity: number;
}

const Scene: React.FC<SceneProps> = ({
  vatTexture,
  vatNormalTexture,
  vatParams,
  isAnimated,
  currentFrame,
  speed,
  modelFile,
  shouldLoadModel,
  loading,
  error,
  ambientLightColor,
  ambientLightIntensity,
  directionalLightColor,
  directionalLightIntensity,
  pointLightColor,
  pointLightIntensity
}) => {
  const { scene, camera, gl } = useThree();
  const [model, setModel] = useState<THREE.Object3D | null>(null);
  
  const clock = useRef(new THREE.Clock());
  const modelRef = useRef<THREE.Object3D | null>(null);

  // Setup scene background
  useEffect(() => {
    scene.background = new THREE.Color(0x000000);
    
    // DEBUG: Test Possibility 4 - Three.js Version Differences
    console.log('=== DEBUG: Three.js Version Differences ===');
    console.log('Three.js version:', THREE.REVISION);
    console.log('WebGL renderer info:', gl.getContext().getParameter(gl.getContext().VERSION));
    console.log('Scene setup complete');
  }, [scene, gl]);

  // Setup lights
  useEffect(() => {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(ambientLightColor, ambientLightIntensity);
    scene.add(ambientLight);
    
    // Directional light
    const directionalLight = new THREE.DirectionalLight(directionalLightColor, directionalLightIntensity);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);
    
    // Point light
    const pointLight = new THREE.PointLight(pointLightColor, pointLightIntensity, 60, 0.5);
    pointLight.position.set(-10, 10, -10);
    scene.add(pointLight);

    // Grid helper
    const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
    scene.add(gridHelper);

    return () => {
      scene.remove(ambientLight);
      scene.remove(directionalLight);
      scene.remove(pointLight);
      scene.remove(gridHelper);
    };
  }, [scene, ambientLightColor, ambientLightIntensity, directionalLightColor, directionalLightIntensity, pointLightColor, pointLightIntensity]);

  // Handle model loading
  useEffect(() => {
    if (modelFile && vatTexture && vatParams && shouldLoadModel) {
      loadModel();
    }
  }, [modelFile, vatTexture, vatParams, shouldLoadModel]);

  const loadModel = async () => {
    if (!modelFile || !vatTexture || !vatParams) return;

    try {
      // Clean up existing model
      if (modelRef.current) {
        scene.remove(modelRef.current);
        modelRef.current.traverse((child: THREE.Object3D) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) {
              if (Array.isArray(mesh.material)) {
                mesh.material.forEach(material => material.dispose());
              } else {
                mesh.material.dispose();
              }
            }
          }
        });
        modelRef.current = null;
      }

      const loader = new GLTFLoader();
      const modelUrl = URL.createObjectURL(modelFile);

      const gltf = await new Promise<{ scene: THREE.Group }>((resolve, reject) => {
        loader.load(
          modelUrl,
          resolve,
          (progress) => {
            console.log('Loading progress:', (progress.loaded / progress.total * 100) + '%');
          },
          reject
        );
      });

      const loadedModel = gltf.scene;
      
      // DEBUG: Test Possibility 1 - GLTF Loading Process
      console.log('=== DEBUG: GLTF Loading Process ===');
      console.log('GLTF loaded successfully:', gltf);
      console.log('Loaded model type:', loadedModel.type);
      console.log('Loaded model children count:', loadedModel.children.length);
      
      // DEBUG: Test Possibility 2 - Attribute Preservation
      console.log('=== DEBUG: Attribute Preservation ===');
      loadedModel.traverse((child: THREE.Object3D) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          console.log('Mesh found:', mesh.name || 'unnamed');
          console.log('Geometry attributes:', Object.keys(mesh.geometry.attributes));
          console.log('UV attributes present:', {
            uv: mesh.geometry.attributes.uv ? 'YES' : 'NO',
            uv1: mesh.geometry.attributes.uv1 ? 'YES' : 'NO',
            uv2: mesh.geometry.attributes.uv2 ? 'YES' : 'NO'
          });
          
          // Log detailed attribute info
          if (mesh.geometry.attributes.uv) {
            console.log('UV attribute details:', {
              count: mesh.geometry.attributes.uv.count,
              itemSize: mesh.geometry.attributes.uv.itemSize,
              array: mesh.geometry.attributes.uv.array.slice(0, 10) // First 10 values
            });
          }
          if (mesh.geometry.attributes.uv1) {
            console.log('UV1 attribute details:', {
              count: mesh.geometry.attributes.uv1.count,
              itemSize: mesh.geometry.attributes.uv1.itemSize,
              array: mesh.geometry.attributes.uv1.array.slice(0, 10) // First 10 values
            });
          }
        }
      });
      
      // Center and scale the model
      const box = new THREE.Box3().setFromObject(loadedModel);
      const center = box.getCenter(new THREE.Vector3());
      loadedModel.position.sub(center);
      
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);

      // DEBUG: Test Possibility 3 - Material Application Timing
      console.log('=== DEBUG: Material Application Timing ===');
      console.log('About to apply VAT materials...');
      
      // Apply VAT material to all meshes
      loadedModel.traverse((child: THREE.Object3D) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          
          // DEBUG: Check attributes BEFORE ensureUVCoordinates
          console.log('Before ensureUVCoordinates - Mesh:', mesh.name || 'unnamed');
          console.log('UV attributes before:', {
            uv: mesh.geometry.attributes.uv ? 'YES' : 'NO',
            uv1: mesh.geometry.attributes.uv1 ? 'YES' : 'NO'
          });
          
          ensureUVCoordinates(mesh.geometry);
          
          // DEBUG: Check attributes AFTER ensureUVCoordinates
          console.log('After ensureUVCoordinates - Mesh:', mesh.name || 'unnamed');
          console.log('UV attributes after:', {
            uv: mesh.geometry.attributes.uv ? 'YES' : 'NO',
            uv1: mesh.geometry.attributes.uv1 ? 'YES' : 'NO'
          });
          
          console.log(mesh.geometry.attributes);

          const originalMaterial = mesh.material;
          const vatMaterial = new MeshStandardOpenVATMaterial(originalMaterial);
          mesh.material = vatMaterial;

          // Configure VAT uniforms
          if (vatTexture && vatMaterial.uniforms) {
            vatMaterial.uniforms.vat_position_texture.value = vatTexture;
          }
          if (vatNormalTexture && vatMaterial.uniforms) {
            vatMaterial.uniforms.vat_normal_texture.value = vatNormalTexture;
          }
          if (vatParams && vatMaterial.uniforms) {
            // DEBUG: VAT Parameters
            console.log('Setting uniforms:', {
              minValues: vatParams.minValues,
              maxValues: vatParams.maxValues,
              FrameCount: vatParams.FrameCount,
              Y_resolution: vatParams.Y_resolution
            });
            
            vatMaterial.uniforms.minValues.value = vatParams.minValues;
            vatMaterial.uniforms.maxValues.value = vatParams.maxValues;
            vatMaterial.uniforms.FrameCount.value = vatParams.FrameCount;
            vatMaterial.uniforms.Y_resolution.value = vatParams.Y_resolution;
            
            // DEBUG: Verify uniforms were set
            console.log('Uniforms after setting:', {
              minValues: vatMaterial.uniforms.minValues.value,
              maxValues: vatMaterial.uniforms.maxValues.value,
              FrameCount: vatMaterial.uniforms.FrameCount.value,
              Y_resolution: vatMaterial.uniforms.Y_resolution.value
            });

            // If Position exists on the params, apply it to the mesh
            if (vatParams.Position) {
              mesh.position.set(vatParams.Position.x, vatParams.Position.y, vatParams.Position.z);
            }
          }

          mesh.castShadow = false;
          mesh.receiveShadow = false;
        }
      });

      scene.add(loadedModel);
      setModel(loadedModel);
      modelRef.current = loadedModel;

      // Adjust camera position
      const distance = maxDim * 2;
      camera.position.set(distance, distance * 0.5, distance);
      camera.lookAt(center);

      URL.revokeObjectURL(modelUrl);
      console.log('GLTF model loaded successfully with VAT material');

    } catch (err) {
      console.error('Error loading model:', err);
    }
  };

  const ensureUVCoordinates = (geometry: THREE.BufferGeometry) => {
    console.log('UV coordinates ensured:', {
      uv: geometry.attributes.uv ? 'present' : 'missing',
      uv1: geometry.attributes.uv1 ? 'present' : 'missing'
    });
  };

  // Animation loop
  useFrame(() => {
    const time = clock.current.getElapsedTime();
    
    // Update time uniform for all materials
    scene.traverse((child) => {
      if (child.isMesh && child.material && child.material.uniforms && child.material.uniforms.time) {
        child.material.uniforms.time.value = time;
      }
    });
  });

  // Update VAT uniforms when props change
  useEffect(() => {
    if (modelRef.current) {
      modelRef.current.traverse((child) => {
        if (child.isMesh && child.material && child.material.uniforms) {
          if (child.material.uniforms.ToggleAnimated) {
            child.material.uniforms.ToggleAnimated.value = isAnimated;
          }
          if (child.material.uniforms.frameSelect) {
            child.material.uniforms.frameSelect.value = currentFrame;
          }
          if (child.material.uniforms.Speed) {
            child.material.uniforms.Speed.value = speed;
          }
        }
      });
    }
  }, [isAnimated, currentFrame, speed]);

  return (
    <>
      <OrbitControls 
        enableDamping 
        dampingFactor={0.05}
        screenSpacePanning={false}
        minDistance={1}
        maxDistance={150}
        maxPolarAngle={Math.PI}
      />
    </>
  );
};

export default Scene;
