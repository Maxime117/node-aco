
//Somewhat hacky way to convert Hex Color to RGB Array.
exports.hexToRgb = function(hex){
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
       parseInt(result[1], 16), //R
       parseInt(result[2], 16), //G
       parseInt(result[3], 16)  //B
    ] : [];
};

exports.rgbToHex = function([r, g, b]){
    return !isNaN(r) && !isNaN(g) && !isNaN(b) ? ("#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)) : "";
};
