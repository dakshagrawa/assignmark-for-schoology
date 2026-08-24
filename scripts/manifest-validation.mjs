const REQUIRED_PERMISSIONS = Object.freeze(['storage']);
const REQUIRED_MATCHES = Object.freeze(['https://fuhsd.schoology.com/*']);

function sameStrings(actual, expected) {
  return Array.isArray(actual)
    && actual.length === expected.length
    && actual.every((value, index) => value === expected[index]);
}

export function validateReleaseManifest(manifest) {
  if (manifest?.manifest_version !== 3) throw new Error('Manifest version validation failed.');
  if (!sameStrings(manifest.permissions, REQUIRED_PERMISSIONS)) {
    throw new Error('Manifest permission validation failed.');
  }
  if (manifest.host_permissions || manifest.optional_permissions || manifest.optional_host_permissions || manifest.externally_connectable) {
    throw new Error('Manifest scope validation failed.');
  }
  if (!Array.isArray(manifest.content_scripts) || manifest.content_scripts.length !== 1) {
    throw new Error('Manifest scope validation failed.');
  }
  if (!sameStrings(manifest.content_scripts[0]?.matches, REQUIRED_MATCHES)) {
    throw new Error('Manifest match validation failed.');
  }
}
