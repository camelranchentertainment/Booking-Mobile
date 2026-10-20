Pod::Spec.new do |s|
  s.name           = 'WatchSync'
  s.version        = '1.0.0'
  s.summary        = 'Sends upcoming shows from the iPhone app to the Camel Ranch Apple Watch app.'
  s.description    = s.summary
  s.license        = 'MIT'
  s.author         = 'Camel Ranch Entertainment'
  s.homepage       = 'https://www.camelranchbooking.com'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'WatchConnectivity'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = '**/*.{h,m,mm,swift}'
end
