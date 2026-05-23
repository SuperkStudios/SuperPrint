#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(SuperPrintLocalAuthentication, NSObject)

RCT_EXTERN_METHOD(authenticate:(NSString *)reason
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
