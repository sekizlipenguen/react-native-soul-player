require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name           = "react-native-soul-player"
  s.version        = package["version"]
  s.summary        = package["description"]
  s.description    = package["description"]
  s.license        = { :type => "UNLICENSED", :file => "README.md" }
  s.author         = package["author"]
  s.homepage       = package["homepage"]
  s.source         = { :git => "https://github.com/sekizlipenguen/react-native-soul-player.git", :tag => "v#{s.version}" }
  s.platforms      = { :ios => "15.1" }
  s.source_files   = "ios/**/*.{h,m,mm,swift}"
  s.frameworks     = "AVKit", "AVFoundation", "MediaPlayer"

  if defined?(install_modules_dependencies)
    install_modules_dependencies(s)
  else
    s.dependency "React-Core"
  end
end
