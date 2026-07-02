# 6-DOF Small Robot Arm — 3D Simulator
A browser-based 3D simulator for a small 6-axis robotic arm. Modeled with Three.js, you can experiment with kinematics and movements by moving the arm on the screen; developed with Vite, available locally or via GitHub Pages. 

Mechanic Small Robot Arm  Construction Videos powered by Skyentific...
https://github.com/SkyentificGit/SmallRobotArm
https://www.youtube.com/watch?v=oFCUw1pXlnA&t=130s

# Video
https://youtu.be/5EUUerlajmY

# Arduino Mega Codes 
[6DoF_Arm_BT_IO/6DoF_Arm_BT_IO.ino](6DoF_Arm_BT_IO/6DoF_Arm_BT_IO.ino)
it has included bluetooth HC06 module compatibility

Board Pin Numbers 
[6DoF_Arm_BT_IO/PinNumbers_For_ArduinoMega.txt](6DoF_Arm_BT_IO/PinNumbers_For_ArduinoMega.txt)

AX	  1	  2	    3	    4	    5	    6
EN   45	  41	  37	  A0	  46	  A6	
DIR	  43  39	  35	  A1	  48	  A7
EN	  33	33	  33	  38	  A2	  A8

RX TX
19 18

## Local Run (Required)

Opening the project from the ZIP and double-clicking only the `index.html` file **does not work**: the browser does not properly load the development module (`src/main.js` + `three` etc.) on `file://` for security reasons; the 3D area remains black.

```bash
cd 6DOF_Small_Robot_Arm_3DSimulator   # or the folder you cloned
npm install
npm run dev
```

Use the address that opens in your browser (usually `http://localhost:5173`).

To try the production build:

```bash
npm run build
npm run preview
```


## GitHub Pages

With **Pages → Source: GitHub Actions** selected in the repository settings, the site is built by pushing to the `main` branch. Address: `https://<user>.github.io/<repository-name>/`

