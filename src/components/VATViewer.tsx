'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import Scene from './Scene';

interface VATParams {
  minValues: THREE.Vector3;
  maxValues: THREE.Vector3;
  FrameCount: number;
  Y_resolution: number;
  Position: THREE.Vector3 | null;
}

// New interfaces for file classification
interface ClassifiedFiles {
  modelFile: File | null;
  positionTexture: File | null;
  normalTexture: File | null;
  remapInfoFile: File | null;
}

interface FileValidationResult {
  isValid: boolean;
  missingFiles: string[];
  errors: string[];
}

interface VATViewerProps {
  // Add props as needed
}

// File classification utility function
const classifyFiles = (files: File[]): ClassifiedFiles => {
  const modelFile = files.find(f => f.name.toLowerCase().endsWith('.glb'));
  const remapInfoFile = files.find(f => f.name.toLowerCase().endsWith('.json'));
  
  const textureFiles = files.filter(f => {
    const name = f.name.toLowerCase();
    return name.endsWith('.exr') || name.endsWith('.png');
  });
  
  // Find normal texture (ends with _vnrm before extension)
  const normalTexture = textureFiles.find(f => {
    const nameWithoutExt = f.name.replace(/\.(exr|png)$/i, '');
    return nameWithoutExt.endsWith('_vnrm');
  });
  
  // Find position texture (does NOT end with _vnrm before extension)
  const positionTexture = textureFiles.find(f => {
    const nameWithoutExt = f.name.replace(/\.(exr|png)$/i, '');
    return !nameWithoutExt.endsWith('_vnrm');
  });
  
  return {
    modelFile: modelFile || null,
    positionTexture: positionTexture || null,
    normalTexture: normalTexture || null,
    remapInfoFile: remapInfoFile || null
  };
};

// File validation utility function
const validateFiles = (classifiedFiles: ClassifiedFiles): FileValidationResult => {
  const missingFiles: string[] = [];
  const errors: string[] = [];
  
  if (!classifiedFiles.modelFile) {
    missingFiles.push('Model file (.glb)');
  }
  
  if (!classifiedFiles.positionTexture) {
    missingFiles.push('Position texture (.exr or .png)');
  }
  
  if (!classifiedFiles.remapInfoFile) {
    missingFiles.push('Remap info file (.json)');
  }
  
  // Note: Normal texture is optional - no validation required
  
  // Check for duplicate texture types only if both textures are present
  if (classifiedFiles.positionTexture && classifiedFiles.normalTexture) {
    const posExt = classifiedFiles.positionTexture.name.split('.').pop()?.toLowerCase();
    const normExt = classifiedFiles.normalTexture.name.split('.').pop()?.toLowerCase();
    
    if (posExt === normExt) {
      // Both textures have same extension, check if they're both _vnrm or both not _vnrm
      const posName = classifiedFiles.positionTexture.name.replace(/\.(exr|png)$/i, '');
      const normName = classifiedFiles.normalTexture.name.replace(/\.(exr|png)$/i, '');
      
      if (posName.endsWith('_vnrm') === normName.endsWith('_vnrm')) {
        errors.push('Both texture files have the same naming convention. One should end with _vnrm and one should not.');
      }
    }
  }
  
  const isValid = missingFiles.length === 0 && errors.length === 0;
  
  return {
    isValid,
    missingFiles,
    errors
  };
};

const VATViewer: React.FC<VATViewerProps> = () => {
  const [vatTexture, setVatTexture] = useState<THREE.Texture | null>(null);
  const [vatNormalTexture, setVatNormalTexture] = useState<THREE.Texture | null>(null);
  const [vatParams, setVatParams] = useState<VATParams | null>(null);
  const [isAnimated, setIsAnimated] = useState(true);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [speed, setSpeed] = useState(24.0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New state variables for multi-file upload system
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [classifiedFiles, setClassifiedFiles] = useState<ClassifiedFiles | null>(null);
  const [fileValidation, setFileValidation] = useState<FileValidationResult | null>(null);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);

  // Ref for file input element
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New state for automatic model loading from multi-file system
  const [shouldLoadModelFromMultiFile, setShouldLoadModelFromMultiFile] = useState(false);

  // Scene lighting properties state
  const [sceneBackgroundColor, setSceneBackgroundColor] = useState('#000000');
  const [ambientLightColor, setAmbientLightColor] = useState('#404040');
  const [ambientLightIntensity, setAmbientLightIntensity] = useState(0.9);
  const [directionalLightColor, setDirectionalLightColor] = useState('#ffffff');
  const [directionalLightIntensity, setDirectionalLightIntensity] = useState(1.5);
  const [pointLightColor, setPointLightColor] = useState('#ffffff');
  const [pointLightIntensity, setPointLightIntensity] = useState(1.5);

  // VAT Details overlay state
  const [showVATDetails, setShowVATDetails] = useState(false);

  // Reset multi-file loading trigger when model is successfully loaded
  useEffect(() => {
    if (shouldLoadModelFromMultiFile && classifiedFiles?.modelFile && vatTexture && vatParams) {
      // Model has been loaded successfully, reset the trigger
      setShouldLoadModelFromMultiFile(false);
      console.log('Multi-file model loading completed, trigger reset');
      
      // Automatically clear the files after successful model loading
      // This provides a clean interface since the user no longer needs to see file info
      clearUploadedFiles();
    }
  }, [shouldLoadModelFromMultiFile, classifiedFiles, vatTexture, vatParams]);

  // Handle multi-file upload and classification
  const handleMultiFileUpload = (files: File[]) => {
    setUploadedFiles(files);
    setIsProcessingFiles(true);
    
    console.log('=== Multi-File Upload Debug ===');
    console.log('Uploaded files:', files.map(f => ({ name: f.name, size: f.size, type: f.type })));
    
    try {
      // Classify the uploaded files
      const classified = classifyFiles(files);
      setClassifiedFiles(classified);
      
      // Validate the classified files
      const validation = validateFiles(classified);
      setFileValidation(validation);
      
      console.log('Files classified:', classified);
      console.log('Validation result:', validation);
      
      // Additional debug info
      console.log('File classification details:');
      files.forEach(file => {
        const nameWithoutExt = file.name.replace(/\.(exr|png|glb|json)$/i, '');
        const isVnrm = nameWithoutExt.endsWith('_vnrm');
        console.log(`- ${file.name}: extension=${file.name.split('.').pop()}, isVnrm=${isVnrm}`);
      });
      
      // If validation passes, automatically process the files
      if (validation.isValid) {
        console.log('Validation passed - starting automatic file processing...');
        // Use setTimeout to ensure state updates are complete before processing
        setTimeout(() => {
          processMultiFileUpload(classified);
        }, 100);
      } else {
        console.log('Validation failed - manual intervention required');
      }
      
    } catch (error) {
      console.error('Error processing files:', error);
      setFileValidation({
        isValid: false,
        missingFiles: [],
        errors: ['Error processing uploaded files']
      });
    } finally {
      setIsProcessingFiles(false);
    }
  };

  // Handle file input change for multi-file upload
  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const fileArray = Array.from(files);
      handleMultiFileUpload(fileArray);
    }
  };

  // Clear uploaded files
  const clearUploadedFiles = () => {
    setUploadedFiles([]);
    setClassifiedFiles(null);
    setFileValidation(null);
    setIsProcessingFiles(false);
    setShouldLoadModelFromMultiFile(false);
    
    // Reset the file input element to clear the displayed file count
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle VAT Details overlay close
  const handleVATDetailsClose = () => {
    setShowVATDetails(false);
  };

  // Handle clicking outside the VAT Details overlay
  const handleOverlayBackgroundClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setShowVATDetails(false);
    }
  };

  // Automatic file processing function for multi-file upload system
  const processMultiFileUpload = async (classified: ClassifiedFiles) => {
    if (!classified.modelFile || !classified.positionTexture || !classified.remapInfoFile) {
      console.log('Missing required files for automatic processing');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('=== Starting Automatic File Processing ===');
      
      // Load position texture first
      const texture = await loadVATTextureFromFile(classified.positionTexture);
      setVatTexture(texture);
      console.log('Position texture loaded successfully');
      
      // Load normal texture if provided (optional)
      if (classified.normalTexture) {
        const normalTexture = await loadVATNormalTextureFromFile(classified.normalTexture);
        setVatNormalTexture(normalTexture);
        console.log('Normal texture loaded successfully');
      } else {
        console.log('No normal texture provided - using position texture only');
      }
      
      // Load remap info with the loaded texture
      await loadVATRemapInfoFromFile(classified.remapInfoFile, texture);
      console.log('Remap info loaded successfully');
      
      // Signal that the model should now be loaded from the multi-file system
      setShouldLoadModelFromMultiFile(true);
      
      console.log('=== Automatic File Processing Complete ===');
      console.log('Model ready to load:', classified.modelFile.name);
      console.log('Multi-file loading trigger set to true');
      
    } catch (error) {
      console.error('Error in automatic file processing:', error);
      setError(error instanceof Error ? error.message : 'Failed to process files automatically');
    } finally {
      setLoading(false);
    }
  };

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
          const osRemap = remapInfo['os-remap'] ?? null;
          
          let yResolution = 512.0;
          if (texture && texture.image) {
            yResolution = texture.image.height;
            console.log('Y resolution extracted from texture:', yResolution);
          } else {
            console.log('Using default Y resolution:', yResolution);
          }

          setVatParams({
            Y_resolution: yResolution,
            FrameCount: osRemap?.Frames ?? 60,
            Position: osRemap?.Position ? new THREE.Vector3(osRemap.Position[0], osRemap.Position[1], osRemap.Position[2]) : null,
            minValues: new THREE.Vector3(
              osRemap?.Min?.[0] ?? -1.0,
              osRemap?.Min?.[1] ?? -1.0,
              osRemap?.Min?.[2] ?? -1.0
            ),
            maxValues: new THREE.Vector3(
              osRemap?.Max?.[0] ?? 1.0,
              osRemap?.Max?.[1] ?? 1.0,
              osRemap?.Max?.[2] ?? 1.0
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

  // handleLoadModel function is removed as per the edit hint

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
          modelFile={classifiedFiles?.modelFile || null}
          shouldLoadModel={shouldLoadModelFromMultiFile}
          loading={loading}
          error={error}
          sceneBackgroundColor={sceneBackgroundColor}
          ambientLightColor={ambientLightColor}
          ambientLightIntensity={ambientLightIntensity}
          directionalLightColor={directionalLightColor}
          directionalLightIntensity={directionalLightIntensity}
          pointLightColor={pointLightColor}
          pointLightIntensity={pointLightIntensity}
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
            
            <div className="space-y-3">
              <label className="flex items-center space-x-2 text-sm">
                <input 
                  type="checkbox" 
                  checked={isAnimated}
                  onChange={(e) => setIsAnimated(e.target.checked)}
                  className="rounded"
                />
                <span>Animated</span>
              </label>
              
              {/* Frame Slider - Only visible when NOT animated */}
              {!isAnimated && (
                <div>
                  <label className="block text-sm mb-1">
                    Frame: <span>{currentFrame + 1}</span>
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
              )}
              
              {/* Speed Slider - Only visible when animated */}
              {isAnimated && (
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
              )}

              {/* VAT Details Info Button */}
              <div className="pt-2">
                <button
                  onClick={() => setShowVATDetails(true)}
                  className="flex items-center space-x-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                  title="View VAT Details"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <span>VAT Details</span>
                </button>
              </div>
            </div>
          </div>

              {/* Scene Controls */}
              <div className="bg-black text-white p-4 rounded-lg min-w-[250px]">
                {/* Scene Background Color Control */}
                <div className="space-y-2 mb-4">
                  <h5 className="text-sm font-semibold text-gray-300">Scene Background</h5>
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      <label className="block text-sm mb-1">Color:</label>
                      <input 
                        type="color" 
                        value={sceneBackgroundColor}
                        onChange={(e) => setSceneBackgroundColor(e.target.value)}
                        className="w-16 h-8 rounded border border-white/30"
                      />
                    </div>
                  </div>
                </div>

                {/* Ambient Light Controls */}
                <div className="space-y-2">
                  <h5 className="text-sm font-semibold text-gray-300">Ambient Light</h5>
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      <label className="block text-sm mb-1">Color:</label>
                      <input 
                        type="color" 
                        value={ambientLightColor}
                        onChange={(e) => setAmbientLightColor(e.target.value)}
                        className="w-16 h-8 rounded border border-white/30"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm mb-1">
                        Intensity: <span>{ambientLightIntensity.toFixed(2)}</span>
                      </label>
                      <input 
                        type="range" 
                        min={0.0} 
                        max={10.0} 
                        step={0.01} 
                        value={ambientLightIntensity}
                        onChange={(e) => setAmbientLightIntensity(parseFloat(e.target.value))}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>

                {/* Directional Light Controls */}
                <div className="space-y-2">
                  <h5 className="text-sm font-semibold text-gray-300">Directional Light</h5>
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      <label className="block text-sm mb-1">Color:</label>
                      <input 
                        type="color" 
                        value={directionalLightColor}
                        onChange={(e) => setDirectionalLightColor(e.target.value)}
                        className="w-16 h-8 rounded border border-white/30"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm mb-1">
                        Intensity: <span>{directionalLightIntensity.toFixed(2)}</span>
                      </label>
                      <input 
                        type="range" 
                        min={0.0} 
                        max={10.0} 
                        step={0.01} 
                        value={directionalLightIntensity}
                        onChange={(e) => setDirectionalLightIntensity(parseFloat(e.target.value))}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>

                {/* Point Light Controls */}
                <div className="space-y-2">
                  <h5 className="text-sm font-semibold text-gray-300">Point Light</h5>
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      <label className="block text-sm mb-1">Color:</label>
                      <input 
                        type="color" 
                        value={pointLightColor}
                        onChange={(e) => setPointLightColor(e.target.value)}
                        className="w-16 h-8 rounded border border-white/30"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm mb-1">
                        Intensity: <span>{pointLightIntensity.toFixed(2)}</span>
                      </label>
                      <input 
                        type="range" 
                        min={0.0} 
                        max={10.0} 
                        step={0.01} 
                        value={pointLightIntensity}
                        onChange={(e) => setPointLightIntensity(parseFloat(e.target.value))}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
              </div>
        </div>
      
      {/* Left Side Controls Container */}
      <div className="absolute top-4 left-4 z-10 space-y-6">
          {/* Info Panel */}
          <div className="bg-black/80 text-white p-4 rounded-lg w-48">
            <h3 className="text-lg font-semibold mb-2">OpenVAT Viewer</h3>
            <p className="text-sm">Mouse: Rotate camera</p>
            <p className="text-sm">Scroll: Zoom in/out</p>
            <p className="text-sm">Right click + drag: Pan</p>
          </div>

          {/* VAT File Upload */}
          <div className="bg-black/80 text-white p-4 rounded-lg min-w-[280px]">
            <h4 className="text-lg font-semibold mb-3">VAT File Upload</h4>
          
            <div className="space-y-3">
              {/* File Input */}
              <div>
                <label className="block text-sm mb-2">Select VAT Files:</label>
                <input 
                  ref={fileInputRef}
                  type="file" 
                  multiple
                  accept=".glb,.exr,.png,.json"
                  onChange={handleFileInputChange}
                  className="w-full text-white bg-transparent border border-white/30 rounded p-2 file:mr-4 file:py-1 file:px-4 file:rounded file:border-0 file:text-sm file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Select .glb, .exr, .png, and .json files (normal texture is optional)
                </p>
                
                {/* File Count Display */}
                <div className="text-xs text-gray-300 mt-1">
                  {uploadedFiles.length === 0 ? 'No files selected' : `${uploadedFiles.length} file${uploadedFiles.length === 1 ? '' : 's'} selected`}
                </div>
              </div>

              {/* File Processing Status */}
              {isProcessingFiles && (
                <div className="text-center py-2">
                  <div className="text-blue-400">Processing files...</div>
                </div>
              )}

              {/* Automatic Processing Status */}
              {shouldLoadModelFromMultiFile && (
                <div className="text-center py-2">
                  <div className="text-green-400">Loading model automatically...</div>
                </div>
              )}

              {/* File Validation Results */}
              {fileValidation && (
                <div className="space-y-2">
                  <h5 className="text-sm font-semibold">File Status:</h5>
                  
                  {/* Required Files Status */}
                  <div className="space-y-1 text-sm">
                    <div className={`flex justify-between ${classifiedFiles?.modelFile ? 'text-green-400' : 'text-red-400'}`}>
                      <span>Model File (.glb):</span>
                      <span>{classifiedFiles?.modelFile ? '✓' : '✗'}</span>
                    </div>
                    <div className={`flex justify-between ${classifiedFiles?.positionTexture ? 'text-green-400' : 'text-red-400'}`}>
                      <span>Position Texture:</span>
                      <span>{classifiedFiles?.positionTexture ? '✓' : '✗'}</span>
                    </div>
                    <div className={`flex justify-between ${classifiedFiles?.normalTexture ? 'text-green-400' : 'text-blue-400'}`}>
                      <span>Normal Texture (optional):</span>
                      <span>{classifiedFiles?.normalTexture ? '✓' : '○'}</span>
                    </div>
                    <div className={`flex justify-between ${classifiedFiles?.remapInfoFile ? 'text-green-400' : 'text-red-400'}`}>
                      <span>Remap Info (.json):</span>
                      <span>{classifiedFiles?.remapInfoFile ? '✓' : '✗'}</span>
                    </div>
                  </div>

                  {/* Missing Files */}
                  {fileValidation.missingFiles.length > 0 && (
                    <div className="text-red-400 text-xs">
                      <div className="font-semibold">Missing:</div>
                      {fileValidation.missingFiles.map((file, index) => (
                        <div key={index}>• {file}</div>
                      ))}
                    </div>
                  )}

                  {/* Errors */}
                  {fileValidation.errors.length > 0 && (
                    <div className="text-red-400 text-xs">
                      <div className="font-semibold">Errors:</div>
                      {fileValidation.errors.map((error, index) => (
                        <div key={index}>• {error}</div>
                      ))}
                    </div>
                  )}

                  {/* Success Message */}
                  {fileValidation.isValid && (
                    <div className="text-green-400 text-sm font-semibold text-center py-2 bg-green-400/10 rounded">
                      {shouldLoadModelFromMultiFile ? 'Loading model automatically...' : 'All files ready! ✓'}
                    </div>
                  )}
                </div>
              )}

              {/* Clear Button */}
              {uploadedFiles.length > 0 && (
                <button 
                  onClick={clearUploadedFiles}
                  className="w-full bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded transition-colors text-sm"
                >
                  Clear Files
                </button>
              )}
            </div>
          </div>
        </div>

        {/* VAT Details Overlay */}
        {showVATDetails && (
          <div 
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
            onClick={handleOverlayBackgroundClick}
          >
            <div className="bg-black/90 text-white p-6 rounded-lg max-w-md w-full mx-4 relative">
              {/* Close Button */}
              <button
                onClick={handleVATDetailsClose}
                className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                title="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <h3 className="text-xl font-semibold mb-4">VAT Details</h3>
              
              <div className="space-y-4">
                {/* VAT Position Texture */}
                <div className="p-3 bg-white/10 rounded">
                  <h4 className="text-sm font-semibold text-gray-300 mb-2">VAT Position Texture</h4>
                  <div className="text-sm">
                    Dimensions: <span className="text-green-400">
                      {vatTexture?.image ? `${vatTexture.image.width} × ${vatTexture.image.height}` : 'Not loaded'}
                    </span>
                  </div>
                </div>

                {/* VAT Normals Texture */}
                <div className="p-3 bg-white/10 rounded">
                  <h4 className="text-sm font-semibold text-gray-300 mb-2">VAT Normals Texture</h4>
                  <div className="text-sm">
                    Dimensions: <span className={vatNormalTexture?.image ? 'text-green-400' : 'text-gray-400'}>
                      {vatNormalTexture?.image ? `${vatNormalTexture.image.width} × ${vatNormalTexture.image.height}` : 'Not loaded'}
                    </span>
                  </div>
                </div>

                {/* Remap Info */}
                <div className="p-3 bg-white/10 rounded">
                  <h4 className="text-sm font-semibold text-gray-300 mb-2">Remap Info</h4>
                  {vatParams ? (
                    <div className="space-y-2 text-sm">
                      <div>Min Values: <span className="text-blue-400">({vatParams.minValues.x.toFixed(2)}, {vatParams.minValues.y.toFixed(2)}, {vatParams.minValues.z.toFixed(2)})</span></div>
                      <div>Max Values: <span className="text-blue-400">({vatParams.maxValues.x.toFixed(2)}, {vatParams.maxValues.y.toFixed(2)}, {vatParams.maxValues.z.toFixed(2)})</span></div>
                      <div>Y Resolution: <span className="text-blue-400">{vatParams.Y_resolution}</span></div>
                      <div>Frame Count: <span className="text-blue-400">{vatParams.FrameCount}</span></div>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-400">Not loaded</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};

export default VATViewer;
