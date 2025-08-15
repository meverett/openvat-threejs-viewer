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
  error
}) => {
  const { scene, camera, gl } = useThree();
  const [model, setModel] = useState<THREE.Object3D | null>(null);
  
  const clock = useRef(new THREE.Clock());
  const modelRef = useRef<THREE.Object3D | null>(null);

  // Setup scene background
  useEffect(() => {
    scene.background = new THREE.Color(0x1a1a1a);
    
    // DEBUG: Test Possibility 4 - Three.js Version Differences
    console.log('=== DEBUG: Three.js Version Differences ===');
    console.log('Three.js version:', THREE.REVISION);
    console.log('WebGL renderer info:', gl.getContext().getParameter(gl.getContext().VERSION));
    console.log('Scene setup complete');
  }, [scene, gl]);

  // Setup lights
  useEffect(() => {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0x404040, 0.9);
    scene.add(ambientLight);
    
    // Directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);
    
    // Point light
    const pointLight = new THREE.PointLight(0xffffff, 1.5);
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
  }, [scene]);

  // Handle model loading
  useEffect(() => {
    if (modelFile && vatTexture && vatParams && shouldLoadModel) {
      loadModel();
    }
  }, [modelFile, vatTexture, vatParams, shouldLoadModel]);

  const loadModel = async () => {
    if (!modelFile || !vatTexture || !vatParams) return;

    // setLoading(true); // Removed local loading state
    // setError(null); // Removed local error state

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
      const scale = 1 / maxDim;
      loadedModel.scale.setScalar(scale);
      
      // DEBUG: Model Scaling Information
      console.log('=== DEBUG: Model Scaling ===');
      console.log('Original model bounds:', { min: box.min, max: box.max });
      console.log('Model size:', size);
      console.log('Applied scale:', scale);
      console.log('Final model bounds after scaling:', {
        min: box.min.clone().multiplyScalar(scale),
        max: box.max.clone().multiplyScalar(scale)
      });
      
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
            console.log('=== DEBUG: VAT Parameters ===');
            console.log('VAT Params loaded:', vatParams);
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
          }

          mesh.castShadow = true;
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
      // setError(err instanceof Error ? err.message : 'Failed to load model'); // Removed local error state
      
      // Add placeholder cube
      addPlaceholderCube();
    } finally {
      // setLoading(false); // Removed local loading state
    }
  };

  const addPlaceholderCube = () => {
    const geometry = new THREE.BoxGeometry(2, 2, 2);
    ensureUVCoordinates(geometry);
    
    const material = new MeshStandardOpenVATMaterial();
    if (vatTexture) material.uniforms.vat_position_texture.value = vatTexture;
    if (vatNormalTexture) material.uniforms.vat_normal_texture.value = vatNormalTexture;
    if (vatParams) {
      material.uniforms.minValues.value = vatParams.minValues;
      material.uniforms.maxValues.value = vatParams.maxValues;
      material.uniforms.FrameCount.value = vatParams.FrameCount;
      material.uniforms.Y_resolution.value = vatParams.Y_resolution;
    }

    const cube = new THREE.Mesh(geometry, material);
    cube.castShadow = true;
    cube.receiveShadow = true;
    scene.add(cube);
    setModel(cube);
    modelRef.current = cube;
  };

  const ensureUVCoordinates = (geometry: THREE.BufferGeometry) => {
    // Check if geometry already has UV coordinates
    if (!geometry.attributes.uv) {
      console.log('No uv coordinates found, generating default uvs');
            
      // Generate default UV coordinates
      const uvs = [];
      const positions = geometry.attributes.position;

      for (let i = 0; i < positions.count; i++) {
          const x = positions.getX(i);
          const y = positions.getY(i);
          const z = positions.getZ(i);
          
          // Generate UVs based on position (simple mapping)
          const u = (x + 1.0) * 0.5; // Map X from [-1,1] to [0,1]
          const v = (y + 1.0) * 0.5; // Map Y from [-1,1] to [0,1]
          
          uvs.push(u, v);
      }

      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    }
    
    // Ensure we have UV1
    if (!geometry.attributes.uv1) {
      console.log('No uv1 coordinates found, copying from uv');
      if (geometry.attributes.uv) {
          geometry.setAttribute('uv1', geometry.attributes.uv.clone());
      } else {
          // Generate UV2 if no UV1 either
          const uvs = [];
          const positions = geometry.attributes.position;
          
          for (let i = 0; i < positions.count; i++) {
              const x = positions.getX(i);
              const y = positions.getY(i);
              const z = positions.getZ(i);
              
              // Generate UV2s based on position (different mapping)
              const u = (z + 1.0) * 0.5; // Map Z from [-1,1] to [0,1]
              const v = (x + 1.0) * 0.5; // Map X from [-1,1] to [0,1]
              
              uvs.push(u, v);
          }
          
          geometry.setAttribute('uv1', new THREE.Float32BufferAttribute(uvs, 2));
      }
    }

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
        maxDistance={50}
        maxPolarAngle={Math.PI}
      />
    </>
  );
};

export default Scene;
