# OpenVAT three.js / WebGL Viewer

An early proof-of-concept WebGL viewer based on [three.js](https://threejs.org/) for viewing
Vertext Animation Textures exported from [OpenVAT](https://openvat.org/).

## Stack
* three.js
* React Fiber
* Next.js
* Tuboback
* Tailwind CSS

## Building

Set this repository as the current directory and then run:

```shell
npm install
```

```shell
npm run dev
```

Browse to [http://localhost:3000](http://localhost:3000)

## Limitations

Currently models have to be exported with these settings in OpenVAT:
* Separate position and normal textures
* glTF only (FBX forces trianglution on import in three.js which messes up the vertex count)
* OpenVAT glTF export currently strips materials during export from Blender, but you can manaully re-add and re-export
* The viewer supports selecting and loading the separate normals texture, but it is not currently used by the fragment shader