#import "CastModule.h"
#import <React/RCTLog.h>
#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>
#import <AVFoundation/AVFoundation.h>
#import <AVKit/AVKit.h>
#import <MediaPlayer/MediaPlayer.h>

@interface CastModule ()
@property (nonatomic, strong) AVRoutePickerView *routePickerView;
@property (nonatomic, assign) BOOL hasListeners;
@property (nonatomic, assign) BOOL lastAirPlayActive;
@end

@implementation CastModule

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

- (NSArray<NSString *> *)supportedEvents {
  return @[@"onAirPlayStart", @"onAirPlayStop"];
}

- (void)startObserving {
  self.hasListeners = YES;
  [[NSNotificationCenter defaultCenter] addObserver:self
                                           selector:@selector(handleRouteChange:)
                                               name:AVAudioSessionRouteChangeNotification
                                             object:nil];
  self.lastAirPlayActive = [self isAirPlayActive];
  // Emit current state so late subscribers sync.
  if (self.lastAirPlayActive) {
    [self sendEventWithName:@"onAirPlayStart" body:@{}];
  }
}

- (void)stopObserving {
  self.hasListeners = NO;
  [[NSNotificationCenter defaultCenter] removeObserver:self
                                                    name:AVAudioSessionRouteChangeNotification
                                                  object:nil];
}

- (void)dealloc {
  [[NSNotificationCenter defaultCenter] removeObserver:self];
}

- (BOOL)isAirPlayActive {
  AVAudioSessionRouteDescription *route = [AVAudioSession sharedInstance].currentRoute;
  for (AVAudioSessionPortDescription *output in route.outputs) {
    if ([output.portType isEqualToString:AVAudioSessionPortAirPlay]) {
      return YES;
    }
  }
  return NO;
}

- (void)handleRouteChange:(NSNotification *)notification {
  if (!self.hasListeners) {
    return;
  }
  BOOL active = [self isAirPlayActive];
  if (active == self.lastAirPlayActive) {
    return;
  }
  self.lastAirPlayActive = active;
  if (active) {
    [self sendEventWithName:@"onAirPlayStart" body:@{}];
  } else {
    [self sendEventWithName:@"onAirPlayStop" body:@{}];
  }
}

RCT_EXPORT_METHOD(showAirPlayPickerDirectly:(RCTResponseSenderBlock)successCallback
                  errorCallback:(RCTResponseSenderBlock)errorCallback)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    UIWindow *keyWindow = nil;
    if (@available(iOS 13.0, *)) {
      for (UIScene *scene in [UIApplication sharedApplication].connectedScenes) {
        if (![scene isKindOfClass:[UIWindowScene class]]) {
          continue;
        }
        for (UIWindow *window in ((UIWindowScene *)scene).windows) {
          if (window.isKeyWindow) {
            keyWindow = window;
            break;
          }
        }
        if (keyWindow) {
          break;
        }
      }
    }
    if (!keyWindow) {
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
      keyWindow = [UIApplication sharedApplication].keyWindow;
#pragma clang diagnostic pop
    }
    if (!keyWindow) {
      errorCallback(@[@"No key window available"]);
      return;
    }

    if (self.routePickerView) {
      [self.routePickerView removeFromSuperview];
      self.routePickerView = nil;
    }

    self.routePickerView = [[AVRoutePickerView alloc] initWithFrame:CGRectMake(-1000, -1000, 1, 1)];
    self.routePickerView.activeTintColor = [UIColor blueColor];
    self.routePickerView.tintColor = [UIColor grayColor];
    self.routePickerView.prioritizesVideoDevices = YES;
    [keyWindow addSubview:self.routePickerView];

    for (UIView *subview in self.routePickerView.subviews) {
      if ([subview isKindOfClass:[UIButton class]]) {
        UIButton *airplayButton = (UIButton *)subview;
        [airplayButton sendActionsForControlEvents:UIControlEventTouchUpInside];
        successCallback(@[@"AirPlay picker opened directly"]);
        return;
      }
    }
    errorCallback(@[@"Failed to open AirPlay picker"]);
  });
}

@end
