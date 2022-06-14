var fs = require('fs');
var color = require('./lib/color-utils');

var colorException = {};

//ACO files take 16 bit words.
function writeValue(writeStream, value) {
    var buffer = new Buffer(2);
    buffer.writeUInt16BE(value, 0);
    writeStream.write(buffer);
}

//Convenient way to write RGB integer values. Expected with this multiplier.
function writeRGBValue(writeStream, value) {
    writeValue(writeStream, value  * 256);
}

//Convenient for adding zero
function writeZero(writeStream) {
    writeValue(writeStream, 0);
}

function readValue(readBuffer) {
    return readBuffer.readUInt16BE(0);
}

function readRGBValue(readBuffer) {
    return readValue(readBuffer) / 256;
}

function readCharValue(readBuffer) {
    return String.fromCharCode(readValue(readBuffer));
}

function sanitizeFilename(filename) {
    filename = filename || 'aco-' + new Date() + '.aco';
    if (filename.lastIndexOf('.aco') !== filename.length - 4) filename = filename + '.aco';
    return filename;
}

exports.make = function(filename, colors, callback) {
    filename = sanitizeFilename(filename);

    colors = colors instanceof Array ? colors : [];

    var aco = fs.createWriteStream(filename);

    //Version 2
    writeValue(aco, 2);

    //Number of colors
    writeValue(aco, colors.length);

    try {
        //For each color, add value and name
        colors.forEach(function(colorInfo) {
            var hex = colorInfo.color;
            var name = colorInfo.name || hex;

            //Parse RGB
            var rgb = color.hexToRgb(hex);

            rgb = rgb.filter(function(value) {
                return !isNaN(value);
            });

            //Make sure we have valid values
            if (rgb.length < 3) {
                throw colorException;
            }

            //Write 0, for RGB color space
            writeZero(aco);

            //R
            writeRGBValue(aco, rgb[0]);
            //G
            writeRGBValue(aco, rgb[1]);
            //B
            writeRGBValue(aco, rgb[2]);
            //Pad (we need w, x, y, and z values. RGB only has w, x, y - so z is zero.
            writeZero(aco);

            //Name
            writeZero(aco);
            writeValue(aco, name.length + 1);
            for(var i = 0, l = name.length; i < l; i++) {
                writeValue(aco, name.charCodeAt(i));
            }
            writeZero(aco);
        });
    } catch (e) {
        console.log(e);
        var error = "Parse Error";
        if (e === colorException) {
            error = "Invalid Color";
        }

        if (callback && 'function' === typeof callback) {
            callback(error);
        } else {
            throw new Error(error);
        }
    }

    aco.end();

    if (callback && 'function' === typeof callback) {
        callback(null, aco);
    }
};

// https://medium.com/swlh/mastering-adobe-color-file-formats-d29e43fde8eb#:~:text=For%20this%20purpose%2C%20Adobe%20offers,ACT%20(Adobe%20Color%20Table).
exports.read = function(filename, callback) {
    var pointer = 0, read = 0;
    var buffer = Buffer.alloc(0);
    var version;
    var colors = [];
    var aco = fs.createReadStream(filename);

    aco.on('readable', onReadable);

    function onReadable() {
        var chunk = aco.read();

        if(chunk === null) {
            buffer = undefined;
            colors = colors.filter(function(value) {
                return value !== undefined;
            });
            callback(null, colors);
            return;
        }

        read += chunk.length;

        var data = Buffer.concat([buffer, chunk]);
        var { length } = data;

        if(version === undefined) {
            version = readValue(data.subarray(pointer, pointer + 2));
            pointer += 2;
        }
        
        if(version === 1 || version === 2) {
            parsePartialACO(data, length);
        } else {
            aco.destroy();
            var error = "Parse Error";

            if (callback && 'function' === typeof callback) {
                callback(error);
            } else {
                throw new Error(error);
            }
        }
    }

    function parsePartialACO(data, length) {
        if(pointer === 2 && length >= pointer + 2) {
            colors.length = readValue(data.subarray(pointer, pointer + 2));
            pointer += 2;
        }
        
        var colorHeaderLength = version === 2 ? 14 : 10;
        var hasTailV2 = version === 1 && colors.length && length > pointer + (colorHeaderLength * colors.length) && readValue(data.subarray(pointer + (colorHeaderLength * colors.length), pointer + (colorHeaderLength * colors.length) + 2)) === 2;

        if(hasTailV2) {
            version = 2;
            colorHeaderLength = 14;
            data = data.subarray(4 + (10 * colors.length));
        }

        if(pointer >= 4) {
            for(var i = 0; i < colors.length; i++) {
                if(colors[i] !== undefined) { continue };

                var colorHeaderData = data.subarray(pointer, pointer + colorHeaderLength);
                if(colorHeaderData.length !== colorHeaderLength) { break; }

                var name = "";

                if(version === 2) {
                    var nameLength = readValue(colorHeaderData.subarray(colorHeaderLength - 2, colorHeaderLength));
                    nameLength--;

                    var colorNameData = data.subarray(pointer + colorHeaderLength, pointer + colorHeaderLength + (nameLength * 2));
                    if(colorNameData.length !== (nameLength * 2)) { break; }

                    pointer += colorHeaderLength + (nameLength * 2) + 2;

                    for(var n = 0; n < nameLength * 2; n += 2) {
                        name += readCharValue(colorNameData.subarray(n, n + 2));
                    }
                } else {
                    pointer += colorHeaderLength;
                }

                var colorspace = readValue(colorHeaderData.subarray(0, 2));
                if(colorspace !== 0) {
                    console.log("Non RGB color (colorspace " + colorspace + ") skipped\n");
                    continue;
                }

                var r = readRGBValue(colorHeaderData.subarray(2, 4));
                var g = readRGBValue(colorHeaderData.subarray(4, 6));
                var b = readRGBValue(colorHeaderData.subarray(6, 8));

                colors[i] = {
                    color: color.rgbToHex([Math.floor(r), Math.floor(g), Math.floor(b)]),
                    name,
                };
            }
        }

        if(pointer < read) {
            buffer = data.subarray(pointer);
        }
    }
}
