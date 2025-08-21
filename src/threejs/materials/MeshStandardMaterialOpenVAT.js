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
            lightPosition: { value: new THREE.Vector3(0.0, 10.0, 0.0) },
            lightColor: { value: new THREE.Color(1.0, 1.0, 1.0) },
            ambientColor: { value: new THREE.Color(0.1, 0.1, 0.1) },
        };

        // Define shader additions
        this.shaderAdditions = {
            vertexUniforms: `
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
            vertexVaryings: `
            varying vec3 v_vat_normal;
            //varying vec3 vFragPos;
            `,
            vertexVatPosition: `
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
            vec2 VAT_UV_offset = uv1 + vec2(0.0, float(currentFrame) * frameStep);
            vec2 VAT_UV_offset_next = uv1 + vec2(0.0, float(nextFrame) * frameStep);

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

            // Sample the VAT normal texture and unpack the normals using UV2
            vec3 VAT_normal = texture(vat_normal_texture, VAT_UV_offset).rgb;
            vec3 VAT_normal_next = texture(vat_normal_texture, VAT_UV_offset_next).rgb;
            VAT_normal = 2.0 * VAT_normal - 1.0; // Unpack the normals from [0, 1] to [-1, 1]
            VAT_normal_next = 2.0 * VAT_normal_next - 1.0; // Unpack the normals from [0, 1] to [-1, 1]

            // Convert to Y up coordinate system
            VAT_normal = vec3(VAT_normal.r, VAT_normal.b, -VAT_normal.g);
            VAT_normal_next = vec3(VAT_normal_next.r, VAT_normal_next.b, -VAT_normal_next.g);

            // Pass the unpacked normals to the fragment shader
            v_vat_normal = normalize(mix(VAT_normal, VAT_normal_next, blend) * normalMatrix);
            //v_vat_normal = normalize(mix(VAT_normal, VAT_normal_next, blend));
            `,
            fragmentShader: `
            varying vec3 vNormal;
            varying vec3 vFragPos;
            varying vec3 v_vat_normal;

            uniform vec3 lightPosition;
            uniform vec3 lightColor;
            uniform vec3 ambientColor;

            uniform sampler2D vat_normal_texture; // Assuming normals are packed in this texture

            void main() {
                // Normalize the normal vector
                vec3 normal = normalize(v_vat_normal);
                //vec3 normal = normalize(vNormal);
                
                // Calculate light direction
                vec3 lightDir = normalize(lightPosition - vFragPos);
                
                // Ambient lighting
                vec3 ambient = ambientColor;
                
                // Diffuse lighting
                float diff = max(dot(normal, lightDir), 0.0);
                vec3 diffuse = diff * lightColor;
                
                // Combine lighting
                vec3 result = ambient + diffuse;

                gl_FragColor = vec4(result, 1.0);
            }
            `,
            fragmentVaryings:
            `
            varying vec3 v_vat_normal;
            `,
            fragmentMain: `
            normal = normalize(v_vat_normal);
            nonPerturbedNormal = normal;
            `
        };
    }

    onBeforeCompile(shader) {
        // console.log("======= Begin Vertex Shader =======");
        // console.log(shader.vertexShader);
        // console.log("======= End Vertex Shader =======");

        // console.log("======= Begin Fragment Shader =======");
        // console.log(shader.fragmentShader);
        // console.log("======= End Fragment Shader =======");

        //console.log("======= Fragment Shader Chunk =======");
        //console.log(THREE.ShaderChunk.normal_fragment_begin);

        //const originalNormalFragmentBegin = THREE.ShaderChunk.normal_fragment_begin;

        console.log(THREE.ShaderChunk.beginnormal_vertex);

        //----------------------

        const customBeginNormalVertex = THREE.ShaderChunk.beginnormal_vertex.replace(
            `vec3 objectNormal = vec3( normal )`,
            `vec3 objectNormal = vec3( v_vat_normal )`
        );

        THREE.ShaderChunk.beginnormal_vertex = customBeginNormalVertex;

        //----------------------

        // const customNormalFragmentBegin = THREE.ShaderChunk.normal_fragment_begin.replace(
        //     `vec3 normal = normalize( vNormal );`,
        //     `vec3 normal = normalize( v_vat_normal );`
        // );


        // THREE.ShaderChunk.normal_fragment_begin = customNormalFragmentBegin;

        //----------------------

        // Add uniforms to shader
        Object.keys(this.uniforms).forEach(key => {
          shader.uniforms[key] = this.uniforms[key];
        });
    
        // Add declarations to top of shaders
        shader.vertexShader = this.shaderAdditions.vertexUniforms + 
                             this.shaderAdditions.attributes + 
                             this.shaderAdditions.vertexVaryings + 
                             shader.vertexShader;
                                      
    
        // Add code inside main() functions
        shader.vertexShader = shader.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>\n${this.shaderAdditions.vertexVatPosition}`
        );
        // ).replace(
        //     `#include <fog_vertex>`,
        //     `#include <fog_vertex>\nvFragPos = vec3(modelMatrix * vec4(transformed, 1.0));`
        // );

        shader.fragmentShader = this.shaderAdditions.fragmentVaryings + shader.fragmentShader;

        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <normal_fragment_begin>',
          `#include <normal_fragment_begin>\n${this.shaderAdditions.fragmentMain}`
        );
    
        super.onBeforeCompile && super.onBeforeCompile(shader);
    }
}
