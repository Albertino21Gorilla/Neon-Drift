const _1sGsdG = (() => {
    const disk = window[String.fromCharCode(108,111,99,97,108,83,116,111,114,97,103,101)];
    const salt = 'q7V_2mR9.zP4';
    function hash(value) {
      let result = 2166136261;
      for (const character of value) result = Math.imul(result ^ character.charCodeAt(0), 16777619);
      return (result >>> 0).toString(36);
    }
    const alias = (key) => '_0x' + hash(salt + key);
    function encode(value) {
      const bytes = new TextEncoder().encode(String(value));
      return btoa(Array.from(bytes, (byte, index) => String.fromCharCode(byte ^ salt.charCodeAt(index % salt.length))).join(''));
    }
    function decode(value) {
      const bytes = Uint8Array.from(atob(value), (character, index) => character.charCodeAt(0) ^ salt.charCodeAt(index % salt.length));
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    }
    function write(key, value) {
      const payload = encode(value);
      disk.setItem(alias(key), 'v1.' + hash(key + payload + salt) + '.' + payload);
    }
    return {
      getItem(key) {
        const saved = disk.getItem(alias(key));
        if (saved !== null) {
          try {
            const [version, check, payload] = saved.split('.');
            if (version !== 'v1' || check !== hash(key + payload + salt)) return null;
            return decode(payload);
          } catch { return null; }
        }
        const legacy = disk.getItem(key);
        if (legacy !== null) {
          // Remove the readable copy only after the encoded save succeeds.
          write(key, legacy);
          disk.removeItem(key);
        }
        return legacy;
      },
      setItem(key, value) {
        write(key, value);
        disk.removeItem(key);
      },
    };
  })();
