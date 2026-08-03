#import <React/RCTBridgeModule.h>
#import <UIKit/UIKit.h>

/**
 * Current interface orientation mask for AppDelegate:
 * `application:supportedInterfaceOrientationsForWindow:`.
 * Host apps must return this (or intersect with their policy) or
 * lockToLandscape / lockToPortrait will not rotate the UI.
 */
UIInterfaceOrientationMask SoulPlayerGetOrientationMask(void);

@interface SoulOrientationModule : NSObject <RCTBridgeModule>
+ (UIInterfaceOrientationMask)currentOrientationMask;
@end
