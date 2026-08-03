#import "SoulBrightnessModule.h"
#import <UIKit/UIKit.h>

@implementation SoulBrightnessModule

RCT_EXPORT_MODULE(SoulBrightnessModule);

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

RCT_EXPORT_METHOD(setBrightnessLevel:(nonnull NSNumber *)level)
{
  CGFloat value = MAX(0.0, MIN(1.0, [level doubleValue]));
  dispatch_async(dispatch_get_main_queue(), ^{
    [UIScreen mainScreen].brightness = value;
  });
}

RCT_EXPORT_METHOD(getBrightnessLevel:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    resolve(@([UIScreen mainScreen].brightness));
  });
}

@end
