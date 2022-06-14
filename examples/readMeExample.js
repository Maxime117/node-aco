var aco = require('../aco');

var colorsArray = new Array(20).fill(null).map(() => ({
    color: '#' + (Math.random() * 0xFFFFFF << 0).toString(16).padStart(6, '0'),
    name: "Awesome color"
}));
console.log(colorsArray)
aco.make('AcoFilePath.aco', colorsArray, function(err, aco) {
    console.log("aco make callback");
    if(err) console.error(err)
    else aco.on('finish', function() {
        console.log('aco write finished', aco.path);
        
        setTimeout(() => {
            read();
        }, 100);
    });
});

function read() {
    aco.read('AcoFilePath.aco', function(err, colors) {
        console.log("aco read callback");
        if(err) console.error(err);
        else console.log("aco got " + colors.length + " colors:", colors);
    })
}