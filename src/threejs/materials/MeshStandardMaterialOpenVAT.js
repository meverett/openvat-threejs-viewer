import * as THREE from 'three';

export class MeshStandardOpenVATMaterial extends THREE.MeshStandardMaterial {
    constructor(originalMaterial = null) {
        // Extract properties from original material
        const inheritedParams = {};
        
        if (originalMaterial) {
            // Copy all standard material properties
            inheritedParams.color = originalMaterial.color ? originalMaterial.color.clone() : new THREE.Color(0xffffff);
            inheritedParams.metalness = originalMaterial.metalness !== undefined ? originalMaterial.metalness : 0.0;
            inheritedParams.roughness = originalMaterial.roughness !== undefined ? originalMaterial.roughness : 1.0;
            inheritedParams.transparent = originalMaterial.transparent;
            inheritedParams.opacity = originalMaterial.opacity;
            inheritedParams.side = originalMaterial.side;
            inheritedParams.alphaTest = originalMaterial.alphaTest;
            
            // Copy texture maps
            inheritedParams.map = originalMaterial.map;
            inheritedParams.normalMap = originalMaterial.normalMap;
            inheritedParams.normalScale = originalMaterial.normalScale ? originalMaterial.normalScale.clone() : undefined;
            inheritedParams.roughnessMap = originalMaterial.roughnessMap;
            inheritedParams.metalnessMap = originalMaterial.metalnessMap;
            inheritedParams.aoMap = originalMaterial.aoMap;
            inheritedParams.aoMapIntensity = originalMaterial.aoMapIntensity;
            inheritedParams.emissive = originalMaterial.emissive ? originalMaterial.emissive.clone() : new THREE.Color(0x000000);
            inheritedParams.emissiveMap = originalMaterial.emissiveMap;
            inheritedParams.emissiveIntensity = originalMaterial.emissiveIntensity;
            inheritedParams.envMap = originalMaterial.envMap;
            inheritedParams.envMapIntensity = originalMaterial.envMapIntensity;
            inheritedParams.lightMap = originalMaterial.lightMap;
            inheritedParams.lightMapIntensity = originalMaterial.lightMapIntensity;
            inheritedParams.alphaMap = originalMaterial.alphaMap;
            inheritedParams.displacementMap = originalMaterial.displacementMap;
            inheritedParams.displacementScale = originalMaterial.displacementScale;
            inheritedParams.displacementBias = originalMaterial.displacementBias;
        }
    
        // Initialize with inherited + custom parameters
        super(inheritedParams);

        // Add custom VAT uniforms
        this.uniforms = {
            
            time: { value: 0.0 },
            vat_position_texture: { value: null },
            vat_normal_texture: { value: null },
            minValues: { value: new THREE.Vector3(-1.0, -1.0, -1.0) },
            maxValues: { value: new THREE.Vector3(1.0, 1.0, 1.0) },
            FrameCount: { value: 60 },
            Y_resolution: { value: 512.0 },
            ToggleAnimated: { value: true },
            frameSelect: { value: 0 },
            Speed: { value: 24.0 },
        };

        // Define shader additions
        this.shaderAdditions = {
            uniforms: `
            uniform float time;
            uniform sampler2D vat_position_texture;
            uniform sampler2D vat_normal_texture; // Assuming normals are packed in this texture
            uniform vec3 minValues; // Min values for X, Y, Z
            uniform vec3 maxValues; // Max values for X, Y, Z
            uniform int FrameCount; // Total number of frames
            uniform float Y_resolution; // Resolution along the Y-axis
            uniform bool ToggleAnimated; // Toggle for animation control
            uniform int frameSelect; // Frame selection when not animated
            uniform float Speed; // Animation speed
            `,
            attributes: `
            attribute vec2 uv1;
            `,
            varyings: `
            varying vec2 v_vat_uv_offset;
            varying vec3 v_vat_normal;
            `,
            vertexMain: `
            // Get the current time and calculate the current frame
            float frameTime;
            int currentFrame;
            int nextFrame;

            if (ToggleAnimated) {
                frameTime = mod(time * Speed, float(FrameCount));
                currentFrame = int(floor(frameTime));
                nextFrame = (currentFrame + 1) % FrameCount;
            } else {
                currentFrame = frameSelect;
                nextFrame = currentFrame;
            }
            
            float blend = fract(frameTime);

            // Calculate the UV offset for the current frame
            float frameStep = 1.0 / Y_resolution;
            vec2 VAT_UV_offset = uv1 + vec2(0.0, 1.0 - float(currentFrame) * frameStep);
            vec2 VAT_UV_offset_next = uv1 + vec2(0.0, 1.0 - float(nextFrame) * frameStep);

            // Pass the UV offset to the fragment shader
            v_vat_uv_offset = VAT_UV_offset;

            // Sample the VAT position texture using uv2
            vec3 VAT_position = texture(vat_position_texture, VAT_UV_offset).rgb;
            vec3 VAT_position_next = texture(vat_position_texture, VAT_UV_offset_next).rgb;
            
            VAT_position = mix(VAT_position, VAT_position_next, blend);

            // Remap each channel of the VAT position to object space individually
            vec3 object_space_position;
            object_space_position.x = minValues.x + VAT_position.x * (maxValues.x - minValues.x);
            object_space_position.z = -1. * (minValues.y + VAT_position.y * (maxValues.y - minValues.y)); //Swap y and z axis from blender. Invert Y axis
            object_space_position.y = minValues.z + VAT_position.z * (maxValues.z - minValues.z);

            // Apply the remapped position to the vertex
            transformed += object_space_position;

            // // Sample the VAT normal texture and unpack the normals using UV2
            // vec3 VAT_normal = texture(vat_normal_texture, VAT_UV_offset).rgb;
            // vec3 VAT_normal_next = texture(vat_normal_texture, VAT_UV_offset_next).rgb;
            // VAT_normal = 2.0 * VAT_normal - 1.0; // Unpack the normals from [0, 1] to [-1, 1]
            // VAT_normal_next = 2.0 * VAT_normal_next - 1.0; // Unpack the normals from [0, 1] to [-1, 1]
            // VAT_normal.r = -VAT_normal.r; // Flip the R channel

            // // Pass the unpacked normals to the fragment shader
            // v_vat_normal = normalize(mix(VAT_normal,VAT_normal_next, blend));
            `
        };
    }

    onBeforeCompile(shader) {
        // Add uniforms to shader
        Object.keys(this.uniforms).forEach(key => {
          shader.uniforms[key] = this.uniforms[key];
        });
    
        // Add declarations to top of shaders
        shader.vertexShader = this.shaderAdditions.uniforms + 
                             this.shaderAdditions.attributes + 
                             this.shaderAdditions.varyings + 
                             shader.vertexShader;
        
        // shader.fragmentShader = this.shaderAdditions.uniforms + 
        //                        this.shaderAdditions.varyings + 
        //                        shader.fragmentShader;
    
        // Add code inside main() functions
        shader.vertexShader = shader.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>\n${this.shaderAdditions.vertexMain}`
        );
    
        // shader.fragmentShader = shader.fragmentShader.replace(
        //   '#include <color_fragment>',
        //   `#include <color_fragment>\n${this.shaderAdditions.fragmentMain}`
        // );
    
        super.onBeforeCompile && super.onBeforeCompile(shader);
    }
}
