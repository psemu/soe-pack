require=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

},{}],"buffer":[function(require,module,exports){
module.exports=require('Cr8VU/');
},{}],"Cr8VU/":[function(require,module,exports){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */

var base64 = require('base64-js')
var ieee754 = require('ieee754')

exports.Buffer = Buffer
exports.SlowBuffer = Buffer
exports.INSPECT_MAX_BYTES = 50
Buffer.poolSize = 8192

/**
 * If `Buffer._useTypedArrays`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (compatible down to IE6)
 */
Buffer._useTypedArrays = (function () {
  // Detect if browser supports Typed Arrays. Supported browsers are IE 10+, Firefox 4+,
  // Chrome 7+, Safari 5.1+, Opera 11.6+, iOS 4.2+. If the browser does not support adding
  // properties to `Uint8Array` instances, then that's the same as no `Uint8Array` support
  // because we need to be able to add all the node Buffer API methods. This is an issue
  // in Firefox 4-29. Now fixed: https://bugzilla.mozilla.org/show_bug.cgi?id=695438
  try {
    var buf = new ArrayBuffer(0)
    var arr = new Uint8Array(buf)
    arr.foo = function () { return 42 }
    return 42 === arr.foo() &&
        typeof arr.subarray === 'function' // Chrome 9-10 lack `subarray`
  } catch (e) {
    return false
  }
})()

/**
 * Class: Buffer
 * =============
 *
 * The Buffer constructor returns instances of `Uint8Array` that are augmented
 * with function properties for all the node `Buffer` API functions. We use
 * `Uint8Array` so that square bracket notation works as expected -- it returns
 * a single octet.
 *
 * By augmenting the instances, we can avoid modifying the `Uint8Array`
 * prototype.
 */
function Buffer (subject, encoding, noZero) {
  if (!(this instanceof Buffer))
    return new Buffer(subject, encoding, noZero)

  var type = typeof subject

  // Workaround: node's base64 implementation allows for non-padded strings
  // while base64-js does not.
  if (encoding === 'base64' && type === 'string') {
    subject = stringtrim(subject)
    while (subject.length % 4 !== 0) {
      subject = subject + '='
    }
  }

  // Find the length
  var length
  if (type === 'number')
    length = coerce(subject)
  else if (type === 'string')
    length = Buffer.byteLength(subject, encoding)
  else if (type === 'object')
    length = coerce(subject.length) // assume that object is array-like
  else
    throw new Error('First argument needs to be a number, array or string.')

  var buf
  if (Buffer._useTypedArrays) {
    // Preferred: Return an augmented `Uint8Array` instance for best performance
    buf = Buffer._augment(new Uint8Array(length))
  } else {
    // Fallback: Return THIS instance of Buffer (created by `new`)
    buf = this
    buf.length = length
    buf._isBuffer = true
  }

  var i
  if (Buffer._useTypedArrays && typeof subject.byteLength === 'number') {
    // Speed optimization -- use set if we're copying from a typed array
    buf._set(subject)
  } else if (isArrayish(subject)) {
    // Treat array-ish objects as a byte array
    for (i = 0; i < length; i++) {
      if (Buffer.isBuffer(subject))
        buf[i] = subject.readUInt8(i)
      else
        buf[i] = subject[i]
    }
  } else if (type === 'string') {
    buf.write(subject, 0, encoding)
  } else if (type === 'number' && !Buffer._useTypedArrays && !noZero) {
    for (i = 0; i < length; i++) {
      buf[i] = 0
    }
  }

  return buf
}

// STATIC METHODS
// ==============

Buffer.isEncoding = function (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.isBuffer = function (b) {
  return !!(b !== null && b !== undefined && b._isBuffer)
}

Buffer.byteLength = function (str, encoding) {
  var ret
  str = str + ''
  switch (encoding || 'utf8') {
    case 'hex':
      ret = str.length / 2
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8ToBytes(str).length
      break
    case 'ascii':
    case 'binary':
    case 'raw':
      ret = str.length
      break
    case 'base64':
      ret = base64ToBytes(str).length
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = str.length * 2
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.concat = function (list, totalLength) {
  assert(isArray(list), 'Usage: Buffer.concat(list, [totalLength])\n' +
      'list should be an Array.')

  if (list.length === 0) {
    return new Buffer(0)
  } else if (list.length === 1) {
    return list[0]
  }

  var i
  if (typeof totalLength !== 'number') {
    totalLength = 0
    for (i = 0; i < list.length; i++) {
      totalLength += list[i].length
    }
  }

  var buf = new Buffer(totalLength)
  var pos = 0
  for (i = 0; i < list.length; i++) {
    var item = list[i]
    item.copy(buf, pos)
    pos += item.length
  }
  return buf
}

// BUFFER INSTANCE METHODS
// =======================

function _hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  assert(strLen % 2 === 0, 'Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; i++) {
    var byte = parseInt(string.substr(i * 2, 2), 16)
    assert(!isNaN(byte), 'Invalid hex string')
    buf[offset + i] = byte
  }
  Buffer._charsWritten = i * 2
  return i
}

function _utf8Write (buf, string, offset, length) {
  var charsWritten = Buffer._charsWritten =
    blitBuffer(utf8ToBytes(string), buf, offset, length)
  return charsWritten
}

function _asciiWrite (buf, string, offset, length) {
  var charsWritten = Buffer._charsWritten =
    blitBuffer(asciiToBytes(string), buf, offset, length)
  return charsWritten
}

function _binaryWrite (buf, string, offset, length) {
  return _asciiWrite(buf, string, offset, length)
}

function _base64Write (buf, string, offset, length) {
  var charsWritten = Buffer._charsWritten =
    blitBuffer(base64ToBytes(string), buf, offset, length)
  return charsWritten
}

function _utf16leWrite (buf, string, offset, length) {
  var charsWritten = Buffer._charsWritten =
    blitBuffer(utf16leToBytes(string), buf, offset, length)
  return charsWritten
}

Buffer.prototype.write = function (string, offset, length, encoding) {
  // Support both (string, offset, length, encoding)
  // and the legacy (string, encoding, offset, length)
  if (isFinite(offset)) {
    if (!isFinite(length)) {
      encoding = length
      length = undefined
    }
  } else {  // legacy
    var swap = encoding
    encoding = offset
    offset = length
    length = swap
  }

  offset = Number(offset) || 0
  var remaining = this.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }
  encoding = String(encoding || 'utf8').toLowerCase()

  var ret
  switch (encoding) {
    case 'hex':
      ret = _hexWrite(this, string, offset, length)
      break
    case 'utf8':
    case 'utf-8':
      ret = _utf8Write(this, string, offset, length)
      break
    case 'ascii':
      ret = _asciiWrite(this, string, offset, length)
      break
    case 'binary':
      ret = _binaryWrite(this, string, offset, length)
      break
    case 'base64':
      ret = _base64Write(this, string, offset, length)
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = _utf16leWrite(this, string, offset, length)
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.prototype.toString = function (encoding, start, end) {
  var self = this

  encoding = String(encoding || 'utf8').toLowerCase()
  start = Number(start) || 0
  end = (end !== undefined)
    ? Number(end)
    : end = self.length

  // Fastpath empty strings
  if (end === start)
    return ''

  var ret
  switch (encoding) {
    case 'hex':
      ret = _hexSlice(self, start, end)
      break
    case 'utf8':
    case 'utf-8':
      ret = _utf8Slice(self, start, end)
      break
    case 'ascii':
      ret = _asciiSlice(self, start, end)
      break
    case 'binary':
      ret = _binarySlice(self, start, end)
      break
    case 'base64':
      ret = _base64Slice(self, start, end)
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = _utf16leSlice(self, start, end)
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.prototype.toJSON = function () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function (target, target_start, start, end) {
  var source = this

  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (!target_start) target_start = 0

  // Copy 0 bytes; we're done
  if (end === start) return
  if (target.length === 0 || source.length === 0) return

  // Fatal error conditions
  assert(end >= start, 'sourceEnd < sourceStart')
  assert(target_start >= 0 && target_start < target.length,
      'targetStart out of bounds')
  assert(start >= 0 && start < source.length, 'sourceStart out of bounds')
  assert(end >= 0 && end <= source.length, 'sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length)
    end = this.length
  if (target.length - target_start < end - start)
    end = target.length - target_start + start

  var len = end - start

  if (len < 100 || !Buffer._useTypedArrays) {
    for (var i = 0; i < len; i++)
      target[i + target_start] = this[i + start]
  } else {
    target._set(this.subarray(start, start + len), target_start)
  }
}

function _base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function _utf8Slice (buf, start, end) {
  var res = ''
  var tmp = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    if (buf[i] <= 0x7F) {
      res += decodeUtf8Char(tmp) + String.fromCharCode(buf[i])
      tmp = ''
    } else {
      tmp += '%' + buf[i].toString(16)
    }
  }

  return res + decodeUtf8Char(tmp)
}

function _asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++)
    ret += String.fromCharCode(buf[i])
  return ret
}

function _binarySlice (buf, start, end) {
  return _asciiSlice(buf, start, end)
}

function _hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; i++) {
    out += toHex(buf[i])
  }
  return out
}

function _utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i+1] * 256)
  }
  return res
}

Buffer.prototype.slice = function (start, end) {
  var len = this.length
  start = clamp(start, len, 0)
  end = clamp(end, len, len)

  if (Buffer._useTypedArrays) {
    return Buffer._augment(this.subarray(start, end))
  } else {
    var sliceLen = end - start
    var newBuf = new Buffer(sliceLen, undefined, true)
    for (var i = 0; i < sliceLen; i++) {
      newBuf[i] = this[i + start]
    }
    return newBuf
  }
}

// `get` will be removed in Node 0.13+
Buffer.prototype.get = function (offset) {
  console.log('.get() is deprecated. Access using array indexes instead.')
  return this.readUInt8(offset)
}

// `set` will be removed in Node 0.13+
Buffer.prototype.set = function (v, offset) {
  console.log('.set() is deprecated. Access using array indexes instead.')
  return this.writeUInt8(v, offset)
}

Buffer.prototype.readUInt8 = function (offset, noAssert) {
  if (!noAssert) {
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'Trying to read beyond buffer length')
  }

  if (offset >= this.length)
    return

  return this[offset]
}

function _readUInt16 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val
  if (littleEndian) {
    val = buf[offset]
    if (offset + 1 < len)
      val |= buf[offset + 1] << 8
  } else {
    val = buf[offset] << 8
    if (offset + 1 < len)
      val |= buf[offset + 1]
  }
  return val
}

Buffer.prototype.readUInt16LE = function (offset, noAssert) {
  return _readUInt16(this, offset, true, noAssert)
}

Buffer.prototype.readUInt16BE = function (offset, noAssert) {
  return _readUInt16(this, offset, false, noAssert)
}

function _readUInt32 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val
  if (littleEndian) {
    if (offset + 2 < len)
      val = buf[offset + 2] << 16
    if (offset + 1 < len)
      val |= buf[offset + 1] << 8
    val |= buf[offset]
    if (offset + 3 < len)
      val = val + (buf[offset + 3] << 24 >>> 0)
  } else {
    if (offset + 1 < len)
      val = buf[offset + 1] << 16
    if (offset + 2 < len)
      val |= buf[offset + 2] << 8
    if (offset + 3 < len)
      val |= buf[offset + 3]
    val = val + (buf[offset] << 24 >>> 0)
  }
  return val
}

Buffer.prototype.readUInt32LE = function (offset, noAssert) {
  return _readUInt32(this, offset, true, noAssert)
}

Buffer.prototype.readUInt32BE = function (offset, noAssert) {
  return _readUInt32(this, offset, false, noAssert)
}

Buffer.prototype.readInt8 = function (offset, noAssert) {
  if (!noAssert) {
    assert(offset !== undefined && offset !== null,
        'missing offset')
    assert(offset < this.length, 'Trying to read beyond buffer length')
  }

  if (offset >= this.length)
    return

  var neg = this[offset] & 0x80
  if (neg)
    return (0xff - this[offset] + 1) * -1
  else
    return this[offset]
}

function _readInt16 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val = _readUInt16(buf, offset, littleEndian, true)
  var neg = val & 0x8000
  if (neg)
    return (0xffff - val + 1) * -1
  else
    return val
}

Buffer.prototype.readInt16LE = function (offset, noAssert) {
  return _readInt16(this, offset, true, noAssert)
}

Buffer.prototype.readInt16BE = function (offset, noAssert) {
  return _readInt16(this, offset, false, noAssert)
}

function _readInt32 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val = _readUInt32(buf, offset, littleEndian, true)
  var neg = val & 0x80000000
  if (neg)
    return (0xffffffff - val + 1) * -1
  else
    return val
}

Buffer.prototype.readInt32LE = function (offset, noAssert) {
  return _readInt32(this, offset, true, noAssert)
}

Buffer.prototype.readInt32BE = function (offset, noAssert) {
  return _readInt32(this, offset, false, noAssert)
}

function _readFloat (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  return ieee754.read(buf, offset, littleEndian, 23, 4)
}

Buffer.prototype.readFloatLE = function (offset, noAssert) {
  return _readFloat(this, offset, true, noAssert)
}

Buffer.prototype.readFloatBE = function (offset, noAssert) {
  return _readFloat(this, offset, false, noAssert)
}

function _readDouble (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset + 7 < buf.length, 'Trying to read beyond buffer length')
  }

  return ieee754.read(buf, offset, littleEndian, 52, 8)
}

Buffer.prototype.readDoubleLE = function (offset, noAssert) {
  return _readDouble(this, offset, true, noAssert)
}

Buffer.prototype.readDoubleBE = function (offset, noAssert) {
  return _readDouble(this, offset, false, noAssert)
}

Buffer.prototype.writeUInt8 = function (value, offset, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'trying to write beyond buffer length')
    verifuint(value, 0xff)
  }

  if (offset >= this.length) return

  this[offset] = value
}

function _writeUInt16 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'trying to write beyond buffer length')
    verifuint(value, 0xffff)
  }

  var len = buf.length
  if (offset >= len)
    return

  for (var i = 0, j = Math.min(len - offset, 2); i < j; i++) {
    buf[offset + i] =
        (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
            (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function (value, offset, noAssert) {
  _writeUInt16(this, value, offset, true, noAssert)
}

Buffer.prototype.writeUInt16BE = function (value, offset, noAssert) {
  _writeUInt16(this, value, offset, false, noAssert)
}

function _writeUInt32 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'trying to write beyond buffer length')
    verifuint(value, 0xffffffff)
  }

  var len = buf.length
  if (offset >= len)
    return

  for (var i = 0, j = Math.min(len - offset, 4); i < j; i++) {
    buf[offset + i] =
        (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function (value, offset, noAssert) {
  _writeUInt32(this, value, offset, true, noAssert)
}

Buffer.prototype.writeUInt32BE = function (value, offset, noAssert) {
  _writeUInt32(this, value, offset, false, noAssert)
}

Buffer.prototype.writeInt8 = function (value, offset, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7f, -0x80)
  }

  if (offset >= this.length)
    return

  if (value >= 0)
    this.writeUInt8(value, offset, noAssert)
  else
    this.writeUInt8(0xff + value + 1, offset, noAssert)
}

function _writeInt16 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7fff, -0x8000)
  }

  var len = buf.length
  if (offset >= len)
    return

  if (value >= 0)
    _writeUInt16(buf, value, offset, littleEndian, noAssert)
  else
    _writeUInt16(buf, 0xffff + value + 1, offset, littleEndian, noAssert)
}

Buffer.prototype.writeInt16LE = function (value, offset, noAssert) {
  _writeInt16(this, value, offset, true, noAssert)
}

Buffer.prototype.writeInt16BE = function (value, offset, noAssert) {
  _writeInt16(this, value, offset, false, noAssert)
}

function _writeInt32 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7fffffff, -0x80000000)
  }

  var len = buf.length
  if (offset >= len)
    return

  if (value >= 0)
    _writeUInt32(buf, value, offset, littleEndian, noAssert)
  else
    _writeUInt32(buf, 0xffffffff + value + 1, offset, littleEndian, noAssert)
}

Buffer.prototype.writeInt32LE = function (value, offset, noAssert) {
  _writeInt32(this, value, offset, true, noAssert)
}

Buffer.prototype.writeInt32BE = function (value, offset, noAssert) {
  _writeInt32(this, value, offset, false, noAssert)
}

function _writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to write beyond buffer length')
    verifIEEE754(value, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }

  var len = buf.length
  if (offset >= len)
    return

  ieee754.write(buf, value, offset, littleEndian, 23, 4)
}

Buffer.prototype.writeFloatLE = function (value, offset, noAssert) {
  _writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function (value, offset, noAssert) {
  _writeFloat(this, value, offset, false, noAssert)
}

function _writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 7 < buf.length,
        'Trying to write beyond buffer length')
    verifIEEE754(value, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }

  var len = buf.length
  if (offset >= len)
    return

  ieee754.write(buf, value, offset, littleEndian, 52, 8)
}

Buffer.prototype.writeDoubleLE = function (value, offset, noAssert) {
  _writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function (value, offset, noAssert) {
  _writeDouble(this, value, offset, false, noAssert)
}

// fill(value, start=0, end=buffer.length)
Buffer.prototype.fill = function (value, start, end) {
  if (!value) value = 0
  if (!start) start = 0
  if (!end) end = this.length

  if (typeof value === 'string') {
    value = value.charCodeAt(0)
  }

  assert(typeof value === 'number' && !isNaN(value), 'value is not a number')
  assert(end >= start, 'end < start')

  // Fill 0 bytes; we're done
  if (end === start) return
  if (this.length === 0) return

  assert(start >= 0 && start < this.length, 'start out of bounds')
  assert(end >= 0 && end <= this.length, 'end out of bounds')

  for (var i = start; i < end; i++) {
    this[i] = value
  }
}

Buffer.prototype.inspect = function () {
  var out = []
  var len = this.length
  for (var i = 0; i < len; i++) {
    out[i] = toHex(this[i])
    if (i === exports.INSPECT_MAX_BYTES) {
      out[i + 1] = '...'
      break
    }
  }
  return '<Buffer ' + out.join(' ') + '>'
}

/**
 * Creates a new `ArrayBuffer` with the *copied* memory of the buffer instance.
 * Added in Node 0.12. Only available in browsers that support ArrayBuffer.
 */
Buffer.prototype.toArrayBuffer = function () {
  if (typeof Uint8Array !== 'undefined') {
    if (Buffer._useTypedArrays) {
      return (new Buffer(this)).buffer
    } else {
      var buf = new Uint8Array(this.length)
      for (var i = 0, len = buf.length; i < len; i += 1)
        buf[i] = this[i]
      return buf.buffer
    }
  } else {
    throw new Error('Buffer.toArrayBuffer not supported in this browser')
  }
}

// HELPER FUNCTIONS
// ================

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

var BP = Buffer.prototype

/**
 * Augment a Uint8Array *instance* (not the Uint8Array class!) with Buffer methods
 */
Buffer._augment = function (arr) {
  arr._isBuffer = true

  // save reference to original Uint8Array get/set methods before overwriting
  arr._get = arr.get
  arr._set = arr.set

  // deprecated, will be removed in node 0.13+
  arr.get = BP.get
  arr.set = BP.set

  arr.write = BP.write
  arr.toString = BP.toString
  arr.toLocaleString = BP.toString
  arr.toJSON = BP.toJSON
  arr.copy = BP.copy
  arr.slice = BP.slice
  arr.readUInt8 = BP.readUInt8
  arr.readUInt16LE = BP.readUInt16LE
  arr.readUInt16BE = BP.readUInt16BE
  arr.readUInt32LE = BP.readUInt32LE
  arr.readUInt32BE = BP.readUInt32BE
  arr.readInt8 = BP.readInt8
  arr.readInt16LE = BP.readInt16LE
  arr.readInt16BE = BP.readInt16BE
  arr.readInt32LE = BP.readInt32LE
  arr.readInt32BE = BP.readInt32BE
  arr.readFloatLE = BP.readFloatLE
  arr.readFloatBE = BP.readFloatBE
  arr.readDoubleLE = BP.readDoubleLE
  arr.readDoubleBE = BP.readDoubleBE
  arr.writeUInt8 = BP.writeUInt8
  arr.writeUInt16LE = BP.writeUInt16LE
  arr.writeUInt16BE = BP.writeUInt16BE
  arr.writeUInt32LE = BP.writeUInt32LE
  arr.writeUInt32BE = BP.writeUInt32BE
  arr.writeInt8 = BP.writeInt8
  arr.writeInt16LE = BP.writeInt16LE
  arr.writeInt16BE = BP.writeInt16BE
  arr.writeInt32LE = BP.writeInt32LE
  arr.writeInt32BE = BP.writeInt32BE
  arr.writeFloatLE = BP.writeFloatLE
  arr.writeFloatBE = BP.writeFloatBE
  arr.writeDoubleLE = BP.writeDoubleLE
  arr.writeDoubleBE = BP.writeDoubleBE
  arr.fill = BP.fill
  arr.inspect = BP.inspect
  arr.toArrayBuffer = BP.toArrayBuffer

  return arr
}

// slice(start, end)
function clamp (index, len, defaultValue) {
  if (typeof index !== 'number') return defaultValue
  index = ~~index;  // Coerce to integer.
  if (index >= len) return len
  if (index >= 0) return index
  index += len
  if (index >= 0) return index
  return 0
}

function coerce (length) {
  // Coerce length to a number (possibly NaN), round up
  // in case it's fractional (e.g. 123.456) then do a
  // double negate to coerce a NaN to 0. Easy, right?
  length = ~~Math.ceil(+length)
  return length < 0 ? 0 : length
}

function isArray (subject) {
  return (Array.isArray || function (subject) {
    return Object.prototype.toString.call(subject) === '[object Array]'
  })(subject)
}

function isArrayish (subject) {
  return isArray(subject) || Buffer.isBuffer(subject) ||
      subject && typeof subject === 'object' &&
      typeof subject.length === 'number'
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    var b = str.charCodeAt(i)
    if (b <= 0x7F)
      byteArray.push(str.charCodeAt(i))
    else {
      var start = i
      if (b >= 0xD800 && b <= 0xDFFF) i++
      var h = encodeURIComponent(str.slice(start, i+1)).substr(1).split('%')
      for (var j = 0; j < h.length; j++)
        byteArray.push(parseInt(h[j], 16))
    }
  }
  return byteArray
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(str)
}

function blitBuffer (src, dst, offset, length) {
  var pos
  for (var i = 0; i < length; i++) {
    if ((i + offset >= dst.length) || (i >= src.length))
      break
    dst[i + offset] = src[i]
  }
  return i
}

function decodeUtf8Char (str) {
  try {
    return decodeURIComponent(str)
  } catch (err) {
    return String.fromCharCode(0xFFFD) // UTF 8 invalid char
  }
}

/*
 * We have to make sure that the value is a valid integer. This means that it
 * is non-negative. It has no fractional component and that it does not
 * exceed the maximum allowed value.
 */
function verifuint (value, max) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value >= 0, 'specified a negative value for writing an unsigned value')
  assert(value <= max, 'value is larger than maximum value for type')
  assert(Math.floor(value) === value, 'value has a fractional component')
}

function verifsint (value, max, min) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value <= max, 'value larger than maximum allowed value')
  assert(value >= min, 'value smaller than minimum allowed value')
  assert(Math.floor(value) === value, 'value has a fractional component')
}

function verifIEEE754 (value, max, min) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value <= max, 'value larger than maximum allowed value')
  assert(value >= min, 'value smaller than minimum allowed value')
}

function assert (test, message) {
  if (!test) throw new Error(message || 'Failed assertion')
}

},{"base64-js":4,"ieee754":5}],4:[function(require,module,exports){
var lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

;(function (exports) {
	'use strict';

  var Arr = (typeof Uint8Array !== 'undefined')
    ? Uint8Array
    : Array

	var ZERO   = '0'.charCodeAt(0)
	var PLUS   = '+'.charCodeAt(0)
	var SLASH  = '/'.charCodeAt(0)
	var NUMBER = '0'.charCodeAt(0)
	var LOWER  = 'a'.charCodeAt(0)
	var UPPER  = 'A'.charCodeAt(0)

	function decode (elt) {
		var code = elt.charCodeAt(0)
		if (code === PLUS)
			return 62 // '+'
		if (code === SLASH)
			return 63 // '/'
		if (code < NUMBER)
			return -1 //no match
		if (code < NUMBER + 10)
			return code - NUMBER + 26 + 26
		if (code < UPPER + 26)
			return code - UPPER
		if (code < LOWER + 26)
			return code - LOWER + 26
	}

	function b64ToByteArray (b64) {
		var i, j, l, tmp, placeHolders, arr

		if (b64.length % 4 > 0) {
			throw new Error('Invalid string. Length must be a multiple of 4')
		}

		// the number of equal signs (place holders)
		// if there are two placeholders, than the two characters before it
		// represent one byte
		// if there is only one, then the three characters before it represent 2 bytes
		// this is just a cheap hack to not do indexOf twice
		var len = b64.length
		placeHolders = '=' === b64.charAt(len - 2) ? 2 : '=' === b64.charAt(len - 1) ? 1 : 0

		// base64 is 4/3 + up to two characters of the original data
		arr = new Arr(b64.length * 3 / 4 - placeHolders)

		// if there are placeholders, only get up to the last complete 4 chars
		l = placeHolders > 0 ? b64.length - 4 : b64.length

		var L = 0

		function push (v) {
			arr[L++] = v
		}

		for (i = 0, j = 0; i < l; i += 4, j += 3) {
			tmp = (decode(b64.charAt(i)) << 18) | (decode(b64.charAt(i + 1)) << 12) | (decode(b64.charAt(i + 2)) << 6) | decode(b64.charAt(i + 3))
			push((tmp & 0xFF0000) >> 16)
			push((tmp & 0xFF00) >> 8)
			push(tmp & 0xFF)
		}

		if (placeHolders === 2) {
			tmp = (decode(b64.charAt(i)) << 2) | (decode(b64.charAt(i + 1)) >> 4)
			push(tmp & 0xFF)
		} else if (placeHolders === 1) {
			tmp = (decode(b64.charAt(i)) << 10) | (decode(b64.charAt(i + 1)) << 4) | (decode(b64.charAt(i + 2)) >> 2)
			push((tmp >> 8) & 0xFF)
			push(tmp & 0xFF)
		}

		return arr
	}

	function uint8ToBase64 (uint8) {
		var i,
			extraBytes = uint8.length % 3, // if we have 1 byte left, pad 2 bytes
			output = "",
			temp, length

		function encode (num) {
			return lookup.charAt(num)
		}

		function tripletToBase64 (num) {
			return encode(num >> 18 & 0x3F) + encode(num >> 12 & 0x3F) + encode(num >> 6 & 0x3F) + encode(num & 0x3F)
		}

		// go through the array every three bytes, we'll deal with trailing stuff later
		for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
			temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
			output += tripletToBase64(temp)
		}

		// pad the end with zeros, but make sure to not forget the extra bytes
		switch (extraBytes) {
			case 1:
				temp = uint8[uint8.length - 1]
				output += encode(temp >> 2)
				output += encode((temp << 4) & 0x3F)
				output += '=='
				break
			case 2:
				temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1])
				output += encode(temp >> 10)
				output += encode((temp >> 4) & 0x3F)
				output += encode((temp << 2) & 0x3F)
				output += '='
				break
		}

		return output
	}

	module.exports.toByteArray = b64ToByteArray
	module.exports.fromByteArray = uint8ToBase64
}())

},{}],5:[function(require,module,exports){
exports.read = function(buffer, offset, isLE, mLen, nBytes) {
  var e, m,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      nBits = -7,
      i = isLE ? (nBytes - 1) : 0,
      d = isLE ? -1 : 1,
      s = buffer[offset + i];

  i += d;

  e = s & ((1 << (-nBits)) - 1);
  s >>= (-nBits);
  nBits += eLen;
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8);

  m = e & ((1 << (-nBits)) - 1);
  e >>= (-nBits);
  nBits += mLen;
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8);

  if (e === 0) {
    e = 1 - eBias;
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity);
  } else {
    m = m + Math.pow(2, mLen);
    e = e - eBias;
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
};

exports.write = function(buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0),
      i = isLE ? 0 : (nBytes - 1),
      d = isLE ? 1 : -1,
      s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0;

  value = Math.abs(value);

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0;
    e = eMax;
  } else {
    e = Math.floor(Math.log(value) / Math.LN2);
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--;
      c *= 2;
    }
    if (e + eBias >= 1) {
      value += rt / c;
    } else {
      value += rt * Math.pow(2, 1 - eBias);
    }
    if (value * c >= 2) {
      e++;
      c /= 2;
    }

    if (e + eBias >= eMax) {
      m = 0;
      e = eMax;
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen);
      e = e + eBias;
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
      e = 0;
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8);

  e = (e << mLen) | m;
  eLen += mLen;
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8);

  buffer[offset + i - d] |= s * 128;
};

},{}],6:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

function noop() {}

process.on = noop;
process.once = noop;
process.off = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}],7:[function(require,module,exports){
(function (process){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length - 1; i >= 0; i--) {
    var last = parts[i];
    if (last === '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Split a filename into [root, dir, basename, ext], unix version
// 'root' is just a slash, or nothing.
var splitPathRe =
    /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
var splitPath = function(filename) {
  return splitPathRe.exec(filename).slice(1);
};

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
  var resolvedPath = '',
      resolvedAbsolute = false;

  for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    var path = (i >= 0) ? arguments[i] : process.cwd();

    // Skip empty and invalid entries
    if (typeof path !== 'string') {
      throw new TypeError('Arguments to path.resolve must be strings');
    } else if (!path) {
      continue;
    }

    resolvedPath = path + '/' + resolvedPath;
    resolvedAbsolute = path.charAt(0) === '/';
  }

  // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe (might happen when process.cwd() fails)

  // Normalize the path
  resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
  var isAbsolute = exports.isAbsolute(path),
      trailingSlash = substr(path, -1) === '/';

  // Normalize the path
  path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }

  return (isAbsolute ? '/' : '') + path;
};

// posix version
exports.isAbsolute = function(path) {
  return path.charAt(0) === '/';
};

// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    if (typeof p !== 'string') {
      throw new TypeError('Arguments to path.join must be strings');
    }
    return p;
  }).join('/'));
};


// path.relative(from, to)
// posix version
exports.relative = function(from, to) {
  from = exports.resolve(from).substr(1);
  to = exports.resolve(to).substr(1);

  function trim(arr) {
    var start = 0;
    for (; start < arr.length; start++) {
      if (arr[start] !== '') break;
    }

    var end = arr.length - 1;
    for (; end >= 0; end--) {
      if (arr[end] !== '') break;
    }

    if (start > end) return [];
    return arr.slice(start, end - start + 1);
  }

  var fromParts = trim(from.split('/'));
  var toParts = trim(to.split('/'));

  var length = Math.min(fromParts.length, toParts.length);
  var samePartsLength = length;
  for (var i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i;
      break;
    }
  }

  var outputParts = [];
  for (var i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..');
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength));

  return outputParts.join('/');
};

exports.sep = '/';
exports.delimiter = ':';

exports.dirname = function(path) {
  var result = splitPath(path),
      root = result[0],
      dir = result[1];

  if (!root && !dir) {
    // No dirname whatsoever
    return '.';
  }

  if (dir) {
    // It has a dirname, strip trailing slash
    dir = dir.substr(0, dir.length - 1);
  }

  return root + dir;
};


exports.basename = function(path, ext) {
  var f = splitPath(path)[2];
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPath(path)[3];
};

function filter (xs, f) {
    if (xs.filter) return xs.filter(f);
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (f(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// String.prototype.substr - negative index don't work in IE8
var substr = 'ab'.substr(-1) === 'b'
    ? function (str, start, len) { return str.substr(start, len) }
    : function (str, start, len) {
        if (start < 0) start = str.length + start;
        return str.substr(start, len);
    }
;

}).call(this,require("C:\\Users\\Jacob\\AppData\\Roaming\\npm\\node_modules\\browserify\\node_modules\\insert-module-globals\\node_modules\\process\\browser.js"))
},{"C:\\Users\\Jacob\\AppData\\Roaming\\npm\\node_modules\\browserify\\node_modules\\insert-module-globals\\node_modules\\process\\browser.js":6}],"jenkins-hash":[function(require,module,exports){
module.exports=require('aQWAyL');
},{}],"aQWAyL":[function(require,module,exports){
/*
32-bit Hash function based on lookup2 by Bob Jenkins:
http://burtleburtle.net/bob/c/lookup2.c
lookup2.c, by Bob Jenkins, December 1996, Public Domain.

JavaScript version by Jacob Seidelin

*/

var JenkinsLookup2 = (function() {

    function mix(a, b, c) {
        /*
        --------------------------------------------------------------------
        mix -- mix 3 32-bit values reversibly.
        For every delta with one or two bit set, and the deltas of all three
          high bits or all three low bits, whether the original value of a,b,c
          is almost all zero or is uniformly distributed,
        * If mix() is run forward or backward, at least 32 bits in a,b,c
          have at least 1/4 probability of changing.
        * If mix() is run forward, every bit of c will change between 1/3 and
          2/3 of the time.  (Well, 22/100 and 78/100 for some 2-bit deltas.)
        mix() was built out of 36 single-cycle latency instructions in a 
          structure that could supported 2x parallelism, like so:
              a -= b; 
              a -= c; x = (c>>13);
              b -= c; a ^= x;
              b -= a; x = (a<<8);
              c -= a; b ^= x;
              c -= b; x = (b>>13);
              ...
          Unfortunately, superscalar Pentiums and Sparcs can't take advantage 
          of that parallelism.  They've also turned some of those single-cycle
          latency instructions into multi-cycle latency instructions.  Still,
          this is the fastest good hash I could find.  There were about 2^^68
          to choose from.  I only looked at a billion or so.
        --------------------------------------------------------------------
        */
        a >>>= 0;
        b >>>= 0;
        c >>>= 0;
        
        a -= b; a -= c; a ^= (c>>>13); a >>>= 0;
        b -= c; b -= a; b ^= (a<<8); b >>>= 0;
        c -= a; c -= b; c ^= (b>>>13); c >>>= 0;
        
        a -= b; a -= c; a ^= (c>>>12); a >>>= 0;
        b -= c; b -= a; b ^= (a<<16); b >>>= 0;
        c -= a; c -= b; c ^= (b>>>5); c >>>= 0;
        
        a -= b; a -= c; a ^= (c>>>3); a >>>= 0;
        b -= c; b -= a; b ^= (a<<10); b >>>= 0;
        c -= a; c -= b; c ^= (b>>>15); c >>>= 0;

        return [a, b, c];
    }

    function hash(data, initval) {
        /*
        --------------------------------------------------------------------
        hash() -- hash a variable-length key into a 32-bit value
          k     : the key (the unaligned variable-length array of bytes)
          len   : the length of the key, counting by bytes
          level : can be any 4-byte value
        Returns a 32-bit value.  Every bit of the key affects every bit of
        the return value.  Every 1-bit and 2-bit delta achieves avalanche.
        About 36+6len instructions.

        The best hash table sizes are powers of 2.  There is no need to do
        mod a prime (mod is sooo slow!).  If you need less than 32 bits,
        use a bitmask.  For example, if you need only 10 bits, do
          h = (h & hashmask(10));
        In which case, the hash table should have hashsize(10) elements.

        If you are hashing n strings (ub1 **)k, do it like this:
          for (i=0, h=0; i<n; ++i) h = hash( k[i], len[i], h);

        By Bob Jenkins, 1996.  bob_jenkins@burtleburtle.net.  You may use this
        code any way you wish, private, educational, or commercial.  It's free.

        See http://burtleburtle.net/bob/hash/evahash.html
        Use for hash table lookup, or anything where one collision in 2^32 is
        acceptable.  Do NOT use for cryptographic purposes.
        --------------------------------------------------------------------
        */
        initval = initval || 0;
        length = lenpos = data.length;
        
        var a, b, c, p, q;

        function ord(chr) {
            return chr.charCodeAt(0);
        }
        
        if (length == 0) {
            return 0
        }

        // Set up the internal state
        a = b = 0x9e3779b9; // the golden ratio; an arbitrary value
        c = initval;        // the previous hash value
        p = 0;

        // ---------------------------------------- handle most of the key
        while (lenpos >= 12) {
            a += (ord(data[p+0]) + (ord(data[p+1])<<8) + (ord(data[p+2])<<16) + (ord(data[p+3])<<24));
            b += (ord(data[p+4]) + (ord(data[p+5])<<8) + (ord(data[p+6])<<16) + (ord(data[p+7])<<24));
            c += (ord(data[p+8]) + (ord(data[p+9])<<8) + (ord(data[p+10])<<16) + (ord(data[p+11])<<24));
            q = mix(a, b, c);
            a = q[0], b = q[1], c = q[2];
            p += 12;
            lenpos -= 12;
        }
        
        // ------------------------- handle the last 11 bytes
        c += length;
        if (lenpos >= 11) c += ord(data[p+10])<<24;
        if (lenpos >= 10) c += ord(data[p+9])<<16;
        if (lenpos >= 9)  c += ord(data[p+8])<<8;
        // the first byte of c is reserved for the length
        if (lenpos >= 8)  b += ord(data[p+7])<<24;
        if (lenpos >= 7)  b += ord(data[p+6])<<16;
        if (lenpos >= 6)  b += ord(data[p+5])<<8;
        if (lenpos >= 5)  b += ord(data[p+4]);
        if (lenpos >= 4)  a += ord(data[p+3])<<24;
        if (lenpos >= 3)  a += ord(data[p+2])<<16;
        if (lenpos >= 2)  a += ord(data[p+1])<<8;
        if (lenpos >= 1)  a += ord(data[p+0]);
        q = mix(a, b, c);
        a = q[0], b = q[1], c = q[2];

        // ------------------------- report the result
        return c >>> 0;
    }

    return hash;

})();


/* Jenkins one-at-a-time hash */

function JenkinsOAAT(key) {
    var hash = 0;
    for (var i=0; i<key.length; ++i) {
        hash += key.charCodeAt(i);
        hash += (hash << 10);
        hash ^= (hash >> 6);
    }
    hash += (hash << 3);
    hash ^= (hash >> 11);
    hash += (hash << 15);
    return (hash >>> 0);
}


exports.lookup2 = JenkinsLookup2;
exports.oaat = JenkinsOAAT;
},{}],10:[function(require,module,exports){
var Buffer = require('buffer').Buffer;

var CRC_TABLE = [
  0x00000000, 0x77073096, 0xee0e612c, 0x990951ba, 0x076dc419,
  0x706af48f, 0xe963a535, 0x9e6495a3, 0x0edb8832, 0x79dcb8a4,
  0xe0d5e91e, 0x97d2d988, 0x09b64c2b, 0x7eb17cbd, 0xe7b82d07,
  0x90bf1d91, 0x1db71064, 0x6ab020f2, 0xf3b97148, 0x84be41de,
  0x1adad47d, 0x6ddde4eb, 0xf4d4b551, 0x83d385c7, 0x136c9856,
  0x646ba8c0, 0xfd62f97a, 0x8a65c9ec, 0x14015c4f, 0x63066cd9,
  0xfa0f3d63, 0x8d080df5, 0x3b6e20c8, 0x4c69105e, 0xd56041e4,
  0xa2677172, 0x3c03e4d1, 0x4b04d447, 0xd20d85fd, 0xa50ab56b,
  0x35b5a8fa, 0x42b2986c, 0xdbbbc9d6, 0xacbcf940, 0x32d86ce3,
  0x45df5c75, 0xdcd60dcf, 0xabd13d59, 0x26d930ac, 0x51de003a,
  0xc8d75180, 0xbfd06116, 0x21b4f4b5, 0x56b3c423, 0xcfba9599,
  0xb8bda50f, 0x2802b89e, 0x5f058808, 0xc60cd9b2, 0xb10be924,
  0x2f6f7c87, 0x58684c11, 0xc1611dab, 0xb6662d3d, 0x76dc4190,
  0x01db7106, 0x98d220bc, 0xefd5102a, 0x71b18589, 0x06b6b51f,
  0x9fbfe4a5, 0xe8b8d433, 0x7807c9a2, 0x0f00f934, 0x9609a88e,
  0xe10e9818, 0x7f6a0dbb, 0x086d3d2d, 0x91646c97, 0xe6635c01,
  0x6b6b51f4, 0x1c6c6162, 0x856530d8, 0xf262004e, 0x6c0695ed,
  0x1b01a57b, 0x8208f4c1, 0xf50fc457, 0x65b0d9c6, 0x12b7e950,
  0x8bbeb8ea, 0xfcb9887c, 0x62dd1ddf, 0x15da2d49, 0x8cd37cf3,
  0xfbd44c65, 0x4db26158, 0x3ab551ce, 0xa3bc0074, 0xd4bb30e2,
  0x4adfa541, 0x3dd895d7, 0xa4d1c46d, 0xd3d6f4fb, 0x4369e96a,
  0x346ed9fc, 0xad678846, 0xda60b8d0, 0x44042d73, 0x33031de5,
  0xaa0a4c5f, 0xdd0d7cc9, 0x5005713c, 0x270241aa, 0xbe0b1010,
  0xc90c2086, 0x5768b525, 0x206f85b3, 0xb966d409, 0xce61e49f,
  0x5edef90e, 0x29d9c998, 0xb0d09822, 0xc7d7a8b4, 0x59b33d17,
  0x2eb40d81, 0xb7bd5c3b, 0xc0ba6cad, 0xedb88320, 0x9abfb3b6,
  0x03b6e20c, 0x74b1d29a, 0xead54739, 0x9dd277af, 0x04db2615,
  0x73dc1683, 0xe3630b12, 0x94643b84, 0x0d6d6a3e, 0x7a6a5aa8,
  0xe40ecf0b, 0x9309ff9d, 0x0a00ae27, 0x7d079eb1, 0xf00f9344,
  0x8708a3d2, 0x1e01f268, 0x6906c2fe, 0xf762575d, 0x806567cb,
  0x196c3671, 0x6e6b06e7, 0xfed41b76, 0x89d32be0, 0x10da7a5a,
  0x67dd4acc, 0xf9b9df6f, 0x8ebeeff9, 0x17b7be43, 0x60b08ed5,
  0xd6d6a3e8, 0xa1d1937e, 0x38d8c2c4, 0x4fdff252, 0xd1bb67f1,
  0xa6bc5767, 0x3fb506dd, 0x48b2364b, 0xd80d2bda, 0xaf0a1b4c,
  0x36034af6, 0x41047a60, 0xdf60efc3, 0xa867df55, 0x316e8eef,
  0x4669be79, 0xcb61b38c, 0xbc66831a, 0x256fd2a0, 0x5268e236,
  0xcc0c7795, 0xbb0b4703, 0x220216b9, 0x5505262f, 0xc5ba3bbe,
  0xb2bd0b28, 0x2bb45a92, 0x5cb36a04, 0xc2d7ffa7, 0xb5d0cf31,
  0x2cd99e8b, 0x5bdeae1d, 0x9b64c2b0, 0xec63f226, 0x756aa39c,
  0x026d930a, 0x9c0906a9, 0xeb0e363f, 0x72076785, 0x05005713,
  0x95bf4a82, 0xe2b87a14, 0x7bb12bae, 0x0cb61b38, 0x92d28e9b,
  0xe5d5be0d, 0x7cdcefb7, 0x0bdbdf21, 0x86d3d2d4, 0xf1d4e242,
  0x68ddb3f8, 0x1fda836e, 0x81be16cd, 0xf6b9265b, 0x6fb077e1,
  0x18b74777, 0x88085ae6, 0xff0f6a70, 0x66063bca, 0x11010b5c,
  0x8f659eff, 0xf862ae69, 0x616bffd3, 0x166ccf45, 0xa00ae278,
  0xd70dd2ee, 0x4e048354, 0x3903b3c2, 0xa7672661, 0xd06016f7,
  0x4969474d, 0x3e6e77db, 0xaed16a4a, 0xd9d65adc, 0x40df0b66,
  0x37d83bf0, 0xa9bcae53, 0xdebb9ec5, 0x47b2cf7f, 0x30b5ffe9,
  0xbdbdf21c, 0xcabac28a, 0x53b39330, 0x24b4a3a6, 0xbad03605,
  0xcdd70693, 0x54de5729, 0x23d967bf, 0xb3667a2e, 0xc4614ab8,
  0x5d681b02, 0x2a6f2b94, 0xb40bbe37, 0xc30c8ea1, 0x5a05df1b,
  0x2d02ef8d
];

function bufferizeInt(num) {
  var tmp = Buffer(4);
  tmp.writeInt32BE(num, 0);
  return tmp;
}

function _crc32(buf, previous) {
  if (!Buffer.isBuffer(buf)) {
    buf = Buffer(buf);
  }
  if (Buffer.isBuffer(previous)) {
    previous = previous.readUInt32BE(0);
  }
  var crc = ~~previous ^ -1;
  for (var n = 0; n < buf.length; n++) {
    crc = CRC_TABLE[(crc ^ buf[n]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ -1);
}

function crc32() {
  return bufferizeInt(_crc32.apply(null, arguments));
}
crc32.signed = function () {
  return _crc32.apply(null, arguments);
};
crc32.unsigned = function () {
  return _crc32.apply(null, arguments) >>> 0;
};

module.exports = crc32;

},{"buffer":"Cr8VU/"}],"soe-pack":[function(require,module,exports){
module.exports=require('lW+hqS');
},{}],"lW+hqS":[function(require,module,exports){
(function (process,Buffer){
var fs = require("fs"),
    path = require("path"),
    crc32 = require("buffer-crc32");

var MAXOPENFILES = 1000;

function writeUInt32BE(stream, number) {
    stream.write(new Buffer([
        number >> 24 & 0xff,
        number >> 16 & 0xff,
        number >> 8 & 0xff,
        number & 0xff
    ]));
}

function writeString(stream, string) {
    stream.write(string);
}

function readUInt32BE(fd, offset) {
    var buf = new Buffer(4);
    fs.readSync(fd, buf, 0, 4, offset);
    return buf.readUInt32BE(0);
}

function readString(fd, offset) {
    var len = readUInt32BE(fd, offset);
    var buf = new Buffer(len);
    fs.readSync(fd, buf, 0, len, offset+4);
    return buf.toString();
}

function listPackFiles(inPath, excludeFiles) {
    if (!fs.existsSync(inPath)) {
        throw "listPackFiles(): inPath does not exist";
    }
    var files = fs.readdirSync(inPath),
        packFiles = [];
    for (var i=0;i<files.length;i++) {
        if (/\.pack$/.test(files[i])) {
            if (!excludeFiles || excludeFiles.indexOf(files[i]) == -1) {
                packFiles.push(files[i]);
            }
        }
    }
    return packFiles;
}

function readPackFile(filePath, file, callback) {
    var assets = [], asset,
        fd, i, offset = 0,
        numAssets, nextOffset;

    filePath = path.join(filePath, file);
    fs.open(filePath, "r", function(err, fd) {
        do {
            nextOffset = readUInt32BE(fd, offset);
            offset += 4;
            numAssets = readUInt32BE(fd, offset);
            offset += 4;
            for (i=0;i<numAssets;i++) {
                asset = {};
                asset.file = file;
                asset.name = readString(fd, offset);
                asset.name_lower = asset.name.toLowerCase();
                offset += asset.name.length + 4;
                asset.offset = readUInt32BE(fd, offset);
                offset += 4;
                asset.length = readUInt32BE(fd, offset);
                offset += 4;
                asset.crc32 = readUInt32BE(fd, offset);
                offset += 4;
                assets.push(asset);
            }
            offset = nextOffset;
        } while (nextOffset);
        fs.close(fd, function(err) {
            callback(err, assets);
        });
    });
}


function readPackFileFromBuffer(data, callback) {
    var assets = [], asset,
        fd, i, offset = 0,
        numAssets, nextOffset;
    do {
        nextOffset = data.readUInt32BE(offset);
        offset += 4;
        numAssets = data.readUInt32BE(offset);
        offset += 4;
        for (i=0;i<numAssets;i++) {
            asset = {};
            var namelength = data.readUInt32BE(offset);
            offset += 4;
            asset.name = data.toString("utf8", offset, offset + namelength);
            asset.name_lower = asset.name.toLowerCase();
            offset += namelength;
            asset.offset = data.readUInt32BE(offset);
            offset += 4;
            asset.length = data.readUInt32BE(offset);
            offset += 4;
            asset.crc32 = data.readUInt32BE(offset);
            offset += 4;
            asset.data = data.slice(asset.offset, asset.offset + asset.length);
            assets.push(asset);

        }
        offset = nextOffset;
    } while (nextOffset);
    callback(null, assets);
}

function append(inFile1, inFile2, outFile) {
    if (!fs.existsSync(inFile1)) {
        throw "append(): inFile1 does not exist";
    }
    if (!fs.existsSync(inFile2)) {
        throw "append(): inFile2 does not exist";
    }

    var data1 = fs.readFileSync(inFile1),
        data2 = fs.readFileSync(inFile2),
        outData = new Buffer(data1.length + data2.length),
        offset = 0, appendOffset = 0,
        numAssets,
        nextOffset = 0, nextAppendOffset;

    console.log("Appending " + data2.length + " bytes to " + inFile1);
    
    data1.copy(outData, 0, 0, data1.length);
    data2.copy(outData, data1.length, 0, data2.length);
    
    do {
        offset = nextOffset;
        nextOffset = data1.readUInt32BE(offset);
    } while (nextOffset);
    
    appendOffset = data1.length;
    outData.writeUInt32BE(appendOffset, offset);
    
    console.log("Rewriting offsets");
    offset = 0;
    do {
        nextOffset = data2.readUInt32BE(offset);
        outData.writeUInt32BE(nextOffset ? appendOffset + nextOffset : 0, appendOffset + offset);
        offset += 4;
        
        numAssets = data2.readUInt32BE(offset);
        offset += 4;
        
        for (i=0;i<numAssets;i++) {
            offset += data2.readUInt32BE(offset) + 4;
            outData.writeUInt32BE(appendOffset + data2.readUInt32BE(offset), appendOffset + offset);
            offset += 12;
        }
        offset = nextOffset;
    } while (nextOffset);

    fs.writeFileSync(outFile, outData);
}

function manifest(inPath, outFile, excludeFiles) {
    var files, file, ext, str,
        i, j, packAssets, 
        assets = [], 
        asset;

    files = listPackFiles(inPath, excludeFiles);
    console.log("Reading assets from " + files.length + " packs");
    function readNextFile() {
        if (files.length) {
            var file = files.shift();
            process.stdout.write(".");
            readPackFile(inPath, file, function(err, packAssets) {
                assets = assets.concat(packAssets);
                readNextFile();
            });
        } else {
            process.stdout.write("\r\n");
            console.log("Writing manifest to " + outFile);
            assets = assets.sort(function(a, b) {
                return a.name_lower < b.name_lower ? -1 : 1;
            });
            str = [["CRC32", "NAME", "PACK", "OFFSET", "LENGTH"].join("\t")];
            for (j=0;j<assets.length;j++) {
                asset = assets[j];
                str[j+1] = [asset.crc32, asset.name, asset.file, asset.offset, asset.length].join("\t");
            }
            fs.writeFile(outFile, str.join("\r\n"), function(err) {
                if (err) {
                    throw err;
                }
                console.log("Done!");
            });
        }
    }
    readNextFile();
}

function readManifest(file) {
    if (!fs.existsSync(file)) {
        throw "readManifest(): file does not exist";
    }

    var data = fs.readFileSync(file).toString(),
        lines = data.split("\r\n"),
        values, 
        assets = {};
    for (var i=1;i<lines.length;i++) {
        values = lines[i].split("\t");
        assets[values[1]] = {
            name: values[1],
            crc32: parseInt(values[0], 10),
            pack: values[2],
            offset: parseInt(values[3], 10),
            length: parseInt(values[4], 10)
        };
    }
    return assets;
}

function diff(oldManifestPath, newManifestPath, outFile) {
    var oldManifest, newManifest, a,
        changes = {
            added: [],
            deleted: [],
            modified: [],
            packChanged: 0,
            offsetChanged: 0
        };

    oldManifest = readManifest(oldManifestPath);
    newManifest = readManifest(newManifestPath);

    for (a in newManifest) {
        if (newManifest.hasOwnProperty(a)) {
            if (oldManifest[a]) {
                if (newManifest[a].crc32 != oldManifest[a].crc32) {
                    changes.modified.push(newManifest[a]);
                } else if (newManifest[a].pack != oldManifest[a].pack) {
                    changes.packChanged++;
                    //changes.packChanged.push(newManifest[a]);
                } else if (newManifest[a].offset != oldManifest[a].offset) {
                    changes.offsetChanged++;
                    //changes.offsetChanged.push(newManifest[a]);
                }
            } else {
                changes.added.push(newManifest[a]);
            }
        }
    }
    for (a in oldManifest) {
        if (oldManifest.hasOwnProperty(a)) {
            if (!newManifest[a]) {
                changes.deleted.push(oldManifest[a]);
            }
        }
    }
    
    console.log("Writing manifest changes to " + outFile);
    fs.writeFileSync(outFile, JSON.stringify(changes, null, 4));
}

function pack(inPath, outPath) {
    var packBuffer = new Buffer(0),
        folderHeaderBuffer,
        fileDataBuffer,
        fileHeaderBuffer,
        i, j, nextOffset, files, stat,
        fileOffset, dataOffset, data,
        fileHeaderLength, dataLength,
        folders, collections = [], collectionFolder;
    
    if (!fs.existsSync(inPath)) {
        throw "pack(): inPath does not exist [" + inPath + "]";
    }

    if (fs.existsSync(outPath)) {
        stat = fs.statSync(outPath);
        if (stat.isDirectory()) {
            throw "pack(): outPath is a directory [" + outPath + "]";
        }
    }
    
    folders = fs.readdirSync(inPath);
    for (i=0;i<folders.length;i++) {
        collectionFolder = path.join(inPath, folders[i]);
        stat = fs.statSync(collectionFolder);
        if (stat.isDirectory()) {
            files = fs.readdirSync(collectionFolder);
            collections.push({
                folder: collectionFolder,
                files: files
            });
        }
    }

    for (i=0;i<collections.length;i++) {
        files = collections[i].files;
        collectionFolder = collections[i].folder;
        fileHeaderLength = 0;
        dataLength = 0;
        for (j=0;j<files.length;j++) {
            fileHeaderLength += 16 + files[j].length;
            stat = fs.statSync(path.join(collectionFolder, files[j]));
            dataLength += stat.size;
        }
            
        folderHeaderBuffer = new Buffer(8);
        fileDataBuffer = new Buffer(dataLength);
        fileHeaderBuffer = new Buffer(fileHeaderLength);

        fileOffset = 0;
        dataOffset = 0;
            
        for (j=0;j<files.length;j++) {
            data = fs.readFileSync(path.join(collectionFolder, files[j]));

            fileHeaderBuffer.writeUInt32BE(files[j].length, fileOffset);
            fileHeaderBuffer.write(files[j], fileOffset + 4, files[j].length);
            fileHeaderBuffer.writeUInt32BE(packBuffer.length + folderHeaderBuffer.length + fileHeaderBuffer.length + dataOffset, fileOffset + files[j].length + 4);
            fileHeaderBuffer.writeUInt32BE(data.length, fileOffset + files[j].length + 8);
            fileHeaderBuffer.writeUInt32BE(crc32.unsigned(data), fileOffset + files[j].length + 12);

            fileOffset += 16 + files[j].length;

            data.copy(fileDataBuffer, dataOffset, 0);
            dataOffset += data.length;
        }
            
        if (i < collections.length-1) {
            nextOffset = packBuffer.length + folderHeaderBuffer.length + fileHeaderBuffer.length + fileDataBuffer.length;
        } else {
            nextOffset = 0;
        }
        
        folderHeaderBuffer.writeUInt32BE(nextOffset, 0);
        folderHeaderBuffer.writeUInt32BE(files.length, 4);

        packBuffer = Buffer.concat([packBuffer, folderHeaderBuffer, fileHeaderBuffer, fileDataBuffer]);
    }
    fs.writeFileSync(outPath, packBuffer);
    return true;
}

function packFromBuffers(files) {
    var packBuffer = new Buffer(0),
        folderHeaderBuffer,
        fileDataBuffer,
        fileHeaderBuffer,
        i, j, nextOffset, stat,
        fileOffset, dataOffset, data,
        fileHeaderLength, dataLength, nameLength;
    
    fileHeaderLength = 0;
    dataLength = 0;

    for (j=0;j<files.length;j++) {
        fileHeaderLength += 16 + files[j].name.length;
        dataLength += files[j].data.length;
    }
        
    folderHeaderBuffer = new Buffer(8);
    fileDataBuffer = new Buffer(dataLength);
    fileHeaderBuffer = new Buffer(fileHeaderLength);

    fileOffset = 0;
    dataOffset = 0;
        
    for (j=0;j<files.length;j++) {
        data = files[j].data;
        nameLength = files[j].name.length;
        fileHeaderBuffer.writeUInt32BE(nameLength, fileOffset);
        fileHeaderBuffer.write(files[j].name, fileOffset + 4, nameLength);
        fileHeaderBuffer.writeUInt32BE(packBuffer.length + folderHeaderBuffer.length + fileHeaderBuffer.length + dataOffset, fileOffset + nameLength + 4);
        fileHeaderBuffer.writeUInt32BE(data.length, fileOffset + nameLength + 8);
        fileHeaderBuffer.writeUInt32BE(crc32.unsigned(data), fileOffset + nameLength + 12);

        fileOffset += 16 + nameLength;

        data.copy(fileDataBuffer, dataOffset, 0);
        dataOffset += data.length;
    }
    nextOffset = 0;
    
    folderHeaderBuffer.writeUInt32BE(nextOffset, 0);
    folderHeaderBuffer.writeUInt32BE(files.length, 4);

    var finalData = new Buffer(packBuffer.length + folderHeaderBuffer.length + fileHeaderBuffer.length + fileDataBuffer.length);
    packBuffer.copy(finalData, 0, 0);
    folderHeaderBuffer.copy(finalData, packBuffer.length, 0);
    fileHeaderBuffer.copy(finalData, packBuffer.length + folderHeaderBuffer.length, 0);
    fileDataBuffer.copy(finalData, packBuffer.length + folderHeaderBuffer.length + fileHeaderBuffer.length, 0);
    return finalData;
}

function extractDiff(diffPath, packPath, outPath, excludeFiles) {
    if (!fs.existsSync(packPath)) {
        throw "extractDiff(): packPath does not exist: " + packPath;
    }
    if (!fs.existsSync(outPath)) {
        throw "extractDiff(): outPath does not exist";
    }
    if (!fs.existsSync(diffPath)) {
        throw "extractDiff(): diffPath does not exist";
    }
    
    var packs = {},
        packStack = [];
    
    function openPack(file, callback) {
        if (packs[file]) {
            callback(null, packs[file]);
            return;
        }
        fs.open(file, "r", function(err, fd) {
            packs[file] = fd;
            packStack.push(file);
            if (packStack.length > MAXOPENFILES) {
                var firstPack = packStack.shift(),
                    firstFd = packs[firstPack];
                    delete packs[firstPack];
                if (firstFd) {
                    fs.close(firstFd, function(err) {
                        callback(err, fd);
                    });
                } else {
                    callback(err, fd);
                }
            } else {
                callback(err, fd);
            }
        });
    }
    
    function extractAssets(assets, outPath, callback) {
        fs.mkdir(outPath, function(err) {
            function nextAsset() {
                if (assets.length === 0) {
                    callback();
                    return;
                }
                var asset = assets.shift(),
                    packName = asset.pack.replace(".pack", "");
                console.log("Extracting " + asset.name + " from " + asset.pack);
                fs.mkdir(outPath, function(err) {
                    openPack(path.join(packPath, asset.pack), function(err, fd) {
                        var buffer = new Buffer(asset.length);
                        fs.read(fd, buffer, 0, asset.length, asset.offset, function(err) {
                            fs.writeFile(path.join(outPath, asset.name), buffer, function(err) {
                                nextAsset();
                            });
                        });
                    });
                });
            }
            nextAsset();
        });
    }

    
    function closePacks(callback) {
        if (packStack.length) {
            var pack = packStack.shift(),
                packFd = packs[pack];
            delete packs[pack];
            if (packFd) {
                console.log("Closing " + pack);
                fs.close(packFd, function() {
                    closePacks(callback);
                });
            } else {
                closePacks(callback);
            }
        } else {
            callback();
        }
    }
    
    console.log("Reading diff: " + diffPath);
    fs.readFile(diffPath, function(err, data) {
        if (err) {
            throw err;
        }
        var diff = JSON.parse(data);
        extractAssets(diff.added.slice(), path.join(outPath, "added"), function() {
            extractAssets(diff.modified.slice(), path.join(outPath, "modified"), function() {
                closePacks(function() {
                    console.log("All done!");
                });
            });
        });
    });
}

function extractAll(inPath, outPath, excludeFiles) {
    var startTime = Date.now(),
        totalAssets = 0;
        packs = listPackFiles(inPath, excludeFiles);

    if (!fs.existsSync(outPath)) {
        throw "extractAll(): outPath does not exist";
    }
    
    console.log("Reading pack files in " + inPath);
    
    function nextPack() {
        if (!packs.length) {
            console.log("Extracted " + totalAssets + " assets in " + ((Date.now() - startTime) / 1000).toFixed(2) + " seconds.");
            return;
        }

        var pack = packs.shift(),
            packPath = path.join(outPath, pack.replace(".pack", ""));

        if (!fs.existsSync(packPath)) {
            fs.mkdirSync(packPath);
        }

        readPackFile(inPath, pack, function(err, assets) {
            console.log("Extracting " + assets.length + " assets from " + pack);
            var asset, n = assets.length;
            fs.readFile(path.join(inPath, pack), function(err, data) {
                for (var i=0;i<assets.length;i++) {
                    asset = assets[i];
                    fs.writeFile(path.join(packPath, asset.name), data.slice(asset.offset, asset.offset+asset.length), 
                        function() {
                            totalAssets++;
                            if (--n === 0) {
                                nextPack();
                            }
                        }
                    );
                }
            });
        });
    }
    nextPack();
}

function extractPack(inPath, outPath) {
    var startTime = Date.now();

    if (!fs.existsSync(outPath)) {
        throw "extractPack(): outPath does not exist";
    }
    
    //console.log("Reading pack file: " + inPath);
    
    readPackFile("", inPath, function(err, assets) {
        //console.log("Extracting " + assets.length + " assets from pack file");
        var asset, n = assets.length;
        fs.readFile(inPath, function(err, data) {
            for (var i=0;i<assets.length;i++) {
                asset = assets[i];
                fs.writeFile(path.join(outPath, asset.name), data.slice(asset.offset, asset.offset+asset.length),
                    function() {}
                );
            }
        });
    });
}


function extractToBuffers(data, callback) {
    readPackFileFromBuffer(data, function(err, assets) {
        callback(err, assets);
    });
}


function extractFile(inPath, file, outPath, excludeFiles, useRegExp, callback) {
    var packs = listPackFiles(inPath, excludeFiles),
        assets, buffer, fd, re, numFound,
        i, j;
    if (!outPath) {
        outPath = ".";
    }
    console.log("Reading pack files in " + inPath);
    if (useRegExp) {
        re = new RegExp(file);
    }
    numFound = 0;
    function nextPack() {
        if (packs.length) {
            var pack = packs.shift(),
                assets;
            readPackFile(inPath, pack, function(err, assets) {
                for (var j=0;j<assets.length;j++) {
                    var isMatch = false;
                    if (useRegExp) {
                        isMatch = re.test(assets[j].name);
                    } else if (assets[j].name == file) {
                        isMatch = true;
                    }
                    if (isMatch) {
                        numFound++;
                        console.log("Extracting file " + assets[j].name + " from " + pack);
                        fd = fs.openSync(path.join(inPath, pack), "r");
                        buffer = new Buffer(assets[j].length);
                        fs.readSync(fd, buffer, 0, assets[j].length, assets[j].offset);
                        fs.closeSync(fd);
                        fs.writeFileSync(path.join(outPath, assets[j].name), buffer);
                    }
                }
                nextPack();
            });
        } else {
            if (numFound) {
                console.log("Extracted " + numFound + " matching asset" + (numFound > 1 ? "s" : ""));
            } else {
                console.log("No matching assets found");
            }
            if (callback) {
                callback();
            }
        }
    }
    nextPack();
}

exports.pack = pack;
exports.packFromBuffers = packFromBuffers;
exports.extractAll = extractAll;
exports.extractPack = extractPack;
exports.extractToBuffers = extractToBuffers;
exports.extractDiff = extractDiff;
exports.extractFile = extractFile;
exports.diff = diff;
exports.append = append;
exports.manifest = manifest;
}).call(this,require("C:\\Users\\Jacob\\AppData\\Roaming\\npm\\node_modules\\browserify\\node_modules\\insert-module-globals\\node_modules\\process\\browser.js"),require("buffer").Buffer)
},{"C:\\Users\\Jacob\\AppData\\Roaming\\npm\\node_modules\\browserify\\node_modules\\insert-module-globals\\node_modules\\process\\browser.js":6,"buffer":"Cr8VU/","buffer-crc32":10,"fs":1,"path":7}]},{},[])