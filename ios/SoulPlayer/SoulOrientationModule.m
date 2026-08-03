#import "SoulOrientationModule.h"
#import <UIKit/UIKit.h>

static UIInterfaceOrientationMask gSoulOrientationMask = UIInterfaceOrientationMaskPortrait;

UIInterfaceOrientationMask SoulPlayerGetOrientationMask(void)
{
  return gSoulOrientationMask;
}

@implementation SoulOrientationModule

RCT_EXPORT_MODULE(SoulOrientationModule);

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

+ (UIInterfaceOrientationMask)currentOrientationMask
{
  return gSoulOrientationMask;
}

// Dikey moda kilitle
RCT_EXPORT_METHOD(lockToPortrait)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    gSoulOrientationMask = UIInterfaceOrientationMaskPortrait;
    if (@available(iOS 16.0, *)) {
      [self updateOrientationWithMask:UIInterfaceOrientationMaskPortrait];
    } else {
      [self setLegacyOrientation:UIInterfaceOrientationPortrait];
    }
  });
}

// Yatay moda kilitle
RCT_EXPORT_METHOD(lockToLandscape)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    gSoulOrientationMask = UIInterfaceOrientationMaskLandscape;
    if (@available(iOS 16.0, *)) {
      [self updateOrientationWithMask:UIInterfaceOrientationMaskLandscape];
    } else {
      [self setLegacyOrientation:UIInterfaceOrientationLandscapeRight];
    }
  });
}

// Tüm yönlendirmeleri serbest bırak
RCT_EXPORT_METHOD(unlockAllOrientations)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    gSoulOrientationMask = UIInterfaceOrientationMaskAllButUpsideDown;
    if (@available(iOS 16.0, *)) {
      [self updateOrientationWithMask:UIInterfaceOrientationMaskAllButUpsideDown];
    } else {
      [self setLegacyOrientation:UIInterfaceOrientationUnknown];
    }
  });
}

/**
 * Hide / show the status bar for immersive fullscreen.
 * Navigation home indicator stays system-managed on iOS.
 */
RCT_EXPORT_METHOD(setImmersiveMode:(BOOL)enabled)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    UIApplication *app = [UIApplication sharedApplication];
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
    // UIViewControllerBasedStatusBarAppearance is false in the example Info.plist;
    // setStatusBarHidden is the reliable path for that host config.
    [app setStatusBarHidden:enabled withAnimation:UIStatusBarAnimationFade];
#pragma clang diagnostic pop

    UIViewController *root = [self topViewController];
    if ([root respondsToSelector:@selector(setNeedsStatusBarAppearanceUpdate)]) {
      [root setNeedsStatusBarAppearanceUpdate];
    }
  });
}

- (UIWindowScene *)activeWindowScene API_AVAILABLE(ios(13.0))
{
  UIApplication *app = [UIApplication sharedApplication];
  UIWindowScene *fallback = nil;
  for (UIScene *scene in app.connectedScenes) {
    if (![scene isKindOfClass:[UIWindowScene class]]) {
      continue;
    }
    UIWindowScene *windowScene = (UIWindowScene *)scene;
    if (windowScene.activationState == UISceneActivationStateForegroundActive) {
      return windowScene;
    }
    if (!fallback) {
      fallback = windowScene;
    }
  }
  return fallback;
}

- (UIViewController *)topViewController
{
  UIApplication *app = [UIApplication sharedApplication];
  UIWindow *keyWindow = nil;
  if (@available(iOS 13.0, *)) {
    UIWindowScene *scene = [self activeWindowScene];
    for (UIWindow *window in scene.windows) {
      if (window.isKeyWindow) {
        keyWindow = window;
        break;
      }
    }
    if (!keyWindow) {
      keyWindow = scene.windows.firstObject;
    }
  }
  if (!keyWindow) {
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
    keyWindow = app.keyWindow;
#pragma clang diagnostic pop
  }
  UIViewController *root = keyWindow.rootViewController;
  while (root.presentedViewController) {
    root = root.presentedViewController;
  }
  return root;
}

- (void)notifySupportedOrientationsChanged
{
  UIViewController *vc = [self topViewController];
  while (vc) {
    if (@available(iOS 16.0, *)) {
      [vc setNeedsUpdateOfSupportedInterfaceOrientations];
    }
    vc = vc.parentViewController;
  }
  UIViewController *root = [self topViewController];
  UINavigationController *nav = root.navigationController;
  if (@available(iOS 16.0, *)) {
    [nav setNeedsUpdateOfSupportedInterfaceOrientations];
  }
}

// iOS 16 ve üzeri için orientation kontrolü
- (void)updateOrientationWithMask:(UIInterfaceOrientationMask)orientationMask API_AVAILABLE(ios(16.0))
{
  if (@available(iOS 16.0, *)) {
    [self notifySupportedOrientationsChanged];
    UIWindowScene *windowScene = [self activeWindowScene];
    if ([windowScene isKindOfClass:[UIWindowScene class]]) {
      UIWindowSceneGeometryPreferencesIOS *geometryPreferences =
          [[UIWindowSceneGeometryPreferencesIOS alloc] initWithInterfaceOrientations:orientationMask];
      [windowScene requestGeometryUpdateWithPreferences:geometryPreferences
                                           errorHandler:^(NSError *_Nonnull error) {
                                             NSLog(@"SoulOrientationModule geometry update error: %@", error);
                                           }];
    } else {
      NSLog(@"SoulOrientationModule: WindowScene not found.");
    }
  }
}

// iOS 13–15 için eski yöntem
- (void)setLegacyOrientation:(UIInterfaceOrientation)orientation
{
  [[UIDevice currentDevice] setValue:@(orientation) forKey:@"orientation"];
  [UIViewController attemptRotationToDeviceOrientation];
}

@end
