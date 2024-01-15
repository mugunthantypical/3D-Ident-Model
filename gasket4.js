
// HTML canvas element where the gasket will be rendered
var canvas;
// WebGL context for rendering
var gl;

// Array to store the vertices of the gasket
var points = [];
// Array to store the colors of the gasket
var colors = [];

// Default number of subdivisions for the gasket
var NumTimesToSubdivide = 3;

// Base colors for the gasket vertices
var baseColors = [
    vec4( 0.0, 1.0, 1.0, 1.0 ),
    vec4( 0.0, 0.5, 0.1, 1.0 ),
    vec4( 0.0, 1.0, 0.6, 1.0 ),
    vec4( 0.9, 0.3, 0.2, 1.0 ),
];

// Function to initialize the WebGL context and set up the canvas
window.onload = function init()
{
    canvas = document.getElementById( "gl-canvas" );
    
// Setting up the WebGL context for the canvas
    gl = WebGLUtils.setupWebGL( canvas );
// Check if WebGL is available
    if ( !gl ) { alert( "WebGL isn't available" ); }
// Set the viewport for WebGL rendering
    gl.viewport( 0, 0, canvas.width, canvas.height );
// Set the clear color for the canvas
    gl.clearColor( 1.0, 1.0, 1.0, 1.0 );

    // enable hidden-surface removal
    gl.enable( gl.DEPTH_TEST );

    //  Load shaders and initialize attribute buffers
    const program = initShaders( gl, "vertex-shader", "fragment-shader" );
    gl.useProgram( program );

    // shader controls
    const controls = {};
    controls.vColor = gl.getAttribLocation( program, "vColor" );
    controls.vPosition = gl.getAttribLocation( program, "vPosition" );
    controls.thetaLoc = gl.getUniformLocation( program, "theta" );
    controls.scaleLoc = gl.getUniformLocation( program, "scale" );
    controls.transLoc = gl.getUniformLocation( program, "trans" );

    // 3D gasket properties
    const gasket = {

        vertices: [
            vec3( 0.0, 0.0, -0.25 ),
            vec3( 0.0, 0.2357, 0.0833 ),
            vec3( -0.2041, -0.1179, 0.0833 ),
            vec3( 0.2041, -0.1179, 0.0833 ),
        ],

        division: 3,
        speed: 200,
        theta: [ 0, 0, 0 ],
        degree: 180,
        rotateXYZ: [ false, false, true ],
        scale: 1,
        scaleFac: 3,
        trans: [ 0.0, 0.0 ],
        transMode: 0,
        pause: true,
    };

    // animation list for 3D gasket
    const animsRegistry = obj => [
        // rotation Z (default)
        rotation.bind( null, obj, -obj.degree, 2 ),
        rotation.bind( null, obj, obj.degree, 2 ),
        rotation.bind( null, obj, 0, 2 ),

        // rotation X if enabled
        rotation.bind( null, obj, -obj.degree, 0 ),
        rotation.bind( null, obj, obj.degree, 0 ),
        rotation.bind( null, obj, 0, 0 ),

        // rotation Y if enabled
        rotation.bind( null, obj, -obj.degree, 1 ),
        rotation.bind( null, obj, obj.degree, 1 ),
        rotation.bind( null, obj, 0, 1 ),

        // enlarge and shrink
        scaling.bind( null, obj, obj.scaleFac ),
        scaling.bind( null, obj, obj.scale ),

        // random hit and bounce
        setDelta.bind( null, obj ),
        translation.bind( null, obj ),
    ];

    // input settings for 3D gasket (quick and dirty way for input with same names)
    const settings = Array.from(document.querySelectorAll(".settings"));
    settings.forEach(setting => {
        setting.addEventListener("change", () => {
            gasket[setting.name] = Number(setting.value);
            let textbox = document.querySelector(
                `[class="textbox"][name="${setting.name}"]`
            );

            if (textbox !== null) {
                textbox.value = setting.value;
            }

            render(controls, gasket);
            gasket.anims = animsRegistry(gasket);
            gasket.currentAnim = gasket.anims.shift();
        });
    });

    const colorPickers = Array.from(document.querySelectorAll(".colorpicker"));
    colorPickers.forEach((cP, i) => {
        cP.addEventListener("change", () => {
            baseColors[i] = hex2rgb(cP.value);
            render(controls, gasket);
        });
    });

    const checkboxes = Array.from(
        document.querySelectorAll('input[type="checkbox"]')
    );
    checkboxes.forEach((checkbox, i) => {
        checkbox.checked = false;
        checkbox.addEventListener("change", e => {
            gasket.rotateXYZ[i] = e.target.checked;
        });
    });

    const inputs = settings.concat(checkboxes);

    const startBtn = document.getElementById("start-button");
    startBtn.addEventListener("click", () => {
        if (!gasket.pause) {
            gasket.pause = true;
            startBtn.value = "Start";
            startBtn.style.background = "#117A65";
        } else {
            gasket.pause = false;
            animate(gasket, controls);
            inputs.forEach(i => {
                i.disabled = true;
            });
            startBtn.value = "Stop";
            startBtn.style.background = "#B03A2E";
        }
    });

    restartBtn = document.getElementById("restart-button"); // global var
    restartBtn.disabled = true;
    restartBtn.addEventListener("click", () => {
        gasket.pause = true;
        gasket.theta = [0, 0, 0];
        gasket.trans = [0.0, 0.0];
        render(controls, gasket);
        gasket.anims = animsRegistry(gasket);
        gasket.currentAnim = gasket.anims.shift();
        inputs.forEach(i => {
            i.disabled = false;
        });
        restartBtn.disabled = true;
        startBtn.value = "Start";
        startBtn.style.background = "#117A65";
    });

    // initial display of static 3D gasket
    render( controls, gasket );

    // obtain animation list and start 3D gasket animation
    gasket.anims = animsRegistry(gasket);
    gasket.currentAnim = gasket.anims.shift();
};

function animate( obj, controls ) {
    if ( obj.pause === true ) {
        return;
    }
    // enable restart button if it is the last animation (translation)
    if ( obj.anims.length === 1 ) {
        restartBtn.disabled = false;
    }
    // current animation completes, switch animation
    if ( obj.currentAnim() ) {
        obj.currentAnim = obj.anims.shift(); // get first animation from list
    } else {
        // current animation has not completed, proceeds with same animation
        gl.uniform3fv( controls.thetaLoc, flatten(obj.theta) );
        gl.uniform1f( controls.scaleLoc, obj.scale );
        gl.uniform2fv( controls.transLoc, obj.trans );
        gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );
        gl.drawArrays( gl.TRIANGLES, 0, points.length );
    }
    requestAnimationFrame( () => animate(obj, controls) );
}

function rotation( obj, degree, axis ) {
    // if rotationX/Y/Z is enabled
    if ( obj.rotateXYZ[axis] === true ) {
        let difference = degree - obj.theta[axis];
        if ( Math.abs(difference) > obj.speed * 0.01 ) {
            // add/subtract based on sign
            obj.theta[axis] += Math.sign(difference) * obj.speed * 0.01;
            return false;
        } else {
            obj.theta[axis] = degree;
            return true;
        }
    } else {
        return true;
    }
}

function scaling( obj, scaleFac ) {
    let difference = scaleFac - obj.scale;
    if ( Math.abs(difference) > obj.speed * 0.0005 ) {
        // add/subtract based on sign
        obj.scale += Math.sign(difference) * obj.speed * 0.0005;
        return false;
    } else {
        obj.scale = scaleFac;
        return true;
    }
}

function translation( obj ) {
    // rotating, rotate about z axis
    if ( obj.transMode === 1 ) {
        obj.theta[2] -= obj.speed * 0.01;
    }

    // dancing, rotate about y axis
    else if ( obj.transMode === 2 ) {
        obj.theta[1] += obj.speed * 0.01;
    }

    // flipping. rotate about x axis
    else if ( obj.transMode === 3 ) {
        obj.theta[0] += obj.speed * 0.01;
    }

    // paralysing, rotate about all axes
    else if ( obj.transMode === 4 ) {
        // alternate between 2 directions
        if ( Math.random() > 0.5 ) {
            obj.theta[0] += obj.speed * 0.01;
            obj.theta[1] += obj.speed * 0.01;
            obj.theta[2] -= obj.speed * 0.01;
        } else {
            obj.theta[0] -= obj.speed * 0.01;
            obj.theta[1] -= obj.speed * 0.01;
            obj.theta[2] += obj.speed * 0.01;
        }
    }

    // reverse x when any vertex hits left/right
    if (
        obj.vertices.some(
            v => Math.abs(v[0] + obj.trans[0] / obj.scale) > 0.97 / obj.scale
        )
    ) {
        obj.deltaX = -obj.deltaX;
    }

    // reverse y when any vertex hits top/bottom
    if (
        obj.vertices.some(
            v => Math.abs(v[1] + obj.trans[1] / obj.scale) > 0.97 / obj.scale
        )
    ) {
        obj.deltaY = -obj.deltaY;
    }
    obj.trans[0] += obj.deltaX;
    obj.trans[1] += obj.deltaY;
    return false;
}

// convert colour picker hex code to vec4
function hex2rgb( hex ) {
    let bigint = parseInt( hex.substring(1), 16 );
    let R = ((bigint >> 16) & 255) / 255;
    let G = ((bigint >> 8) & 255) / 255;
    let B = (bigint & 255) / 255;
    return vec4( R, G, B, 1.0 );
}

// adjust delta (displacement) based on object's speed
function setDelta( obj ) {
    obj.deltaX = obj.speed * Math.cos(Math.PI / 3) * 0.00004;
    obj.deltaY = obj.speed * Math.sin(Math.PI / 3) * 0.00004;
    return true;
}

// Function to render the gasket based on the current controls and object properties
function render( controls, obj ) {
    points = []; // Reset the points array for new vertex data
    colors = []; // Reset the colors array for new color data

    // Recursively divide the tetrahedron based on the object's vertices and division level
    divideTetra(
        obj.vertices[0],
        obj.vertices[1],
        obj.vertices[2],
        obj.vertices[3],
        obj.division
    );

    // Create and bind a buffer for color data
    let cBuffer = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, cBuffer );
    gl.bufferData( gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW );
    gl.vertexAttribPointer( controls.vColor, 4, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( controls.vColor );

    // Create and bind a buffer for vertex data
    let vBuffer = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, vBuffer );
    gl.bufferData( gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW );
    gl.vertexAttribPointer( controls.vPosition, 3, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( controls.vPosition );

    // Set shader uniform variables for transformations
    gl.uniform3fv( controls.thetaLoc, flatten(obj.theta) ); // Rotation
    gl.uniform1f( controls.scaleLoc, obj.scale ); // Scaling
    gl.uniform2fv( controls.transLoc, obj.trans ); // Translation

    // Clear the canvas and draw the triangles
    gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );
    gl.drawArrays( gl.TRIANGLES, 0, points.length );
}

// Function to create a triangle by pushing vertices and their corresponding colors to the arrays
function triangle( a, b, c, color ) {
    // Add the base color and vertices for each point of the triangle
    colors.push( baseColors[color] ); // Color for vertex a
    points.push( a ); // Vertex a
    colors.push( baseColors[color] ); // Color for vertex b
    points.push( b ); // Vertex b
    colors.push( baseColors[color] ); // Color for vertex c
    points.push( c ); // Vertex c
}

function tetra( a, b, c, d )
{
    // tetrahedron with each side using
    // a different color
    triangle( a, c, b, 0 );
    triangle( a, c, d, 1 );
    triangle( a, b, d, 2 );
    triangle( b, c, d, 3 );
}

function divideTetra( a, b, c, d, count )
{
    // check for end of recursion
    
    if ( count === 0 ) {
        tetra( a, b, c, d );
    }
    
    // find midpoints of sides
    // divide four smaller tetrahedra
    
    else {
        let ab = mix( a, b, 0.5 );
        let ac = mix( a, c, 0.5 );
        let ad = mix( a, d, 0.5 );
        let bc = mix( b, c, 0.5 );
        let bd = mix( b, d, 0.5 );
        let cd = mix( c, d, 0.5 );

        --count;
        
        divideTetra(  a, ab, ac, ad, count );
        divideTetra( ab,  b, bc, bd, count );
        divideTetra( ac, bc,  c, cd, count );
        divideTetra( ad, bd, cd,  d, count );
    }
}

