module.exports = {
  dependency: {
    platforms: {
      ios: {},
      android: {
        sourceDir: './android',
        packageImportPath: 'import com.sekizlipenguen.soulplayer.SoulPlayerPackage;',
        packageInstance: 'new SoulPlayerPackage()',
      },
    },
  },
};
