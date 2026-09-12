#!/usr/bin/env python3
"""Regenerate dependency-free Xcode projects from checked-in app sources."""
from pathlib import Path
import hashlib
import json
import plistlib
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
APP_NAMES = ["Gather", "Keeps", "Orbit"]


def atom(value):
    if isinstance(value, dict):
        return "{\n" + "\n".join(f"{atom(k)} = {atom(v)};" for k, v in value.items()) + "\n}"
    if isinstance(value, list):
        return "(\n" + "\n".join(atom(v) + "," for v in value) + "\n)"
    value = str(value)
    return value if re.fullmatch(r"[A-Za-z0-9_./]+", value) else json.dumps(value, ensure_ascii=False)


def build(name):
    objects = {}

    def ident(label):
        return hashlib.sha256((name + ":" + label).encode()).hexdigest()[:24].upper()

    def add(label, **fields):
        key = ident(label)
        objects[key] = fields
        return key

    def configurations(label, common, debug_extra=None, release_extra=None):
        ids = []
        for kind in ["Debug", "Release"]:
            settings = dict(common)
            if kind == "Debug":
                settings.update(SWIFT_OPTIMIZATION_LEVEL="-Onone", DEBUG_INFORMATION_FORMAT="dwarf", ENABLE_TESTABILITY="YES", ONLY_ACTIVE_ARCH="YES", GCC_PREPROCESSOR_DEFINITIONS=["DEBUG=1", "$(inherited)"], SWIFT_ACTIVE_COMPILATION_CONDITIONS="DEBUG")
                settings.update(debug_extra or {})
            else:
                settings.update(SWIFT_COMPILATION_MODE="wholemodule", DEBUG_INFORMATION_FORMAT="dwarf-with-dsym")
                settings.update(release_extra or {})
            ids.append(add(f"{label}-{kind}", isa="XCBuildConfiguration", buildSettings=settings, name=kind))
        return add(label + "-configs", isa="XCConfigurationList", buildConfigurations=ids, defaultConfigurationIsVisible=0, defaultConfigurationName="Release")

    products = []
    groups = []
    targets = []
    app_target = ident("app-target")
    for kind, folder, product_type, suffix in [
        ("app", name, "com.apple.product-type.application", ".app"),
        ("unit", name + "Tests", "com.apple.product-type.bundle.unit-test", ".xctest"),
        ("ui", name + "UITests", "com.apple.product-type.bundle.ui-testing", ".xctest"),
    ]:
        source_refs = []
        source_builds = []
        resource_builds = []
        for source in sorted((ROOT / folder).rglob("*.swift")):
            rel = source.relative_to(ROOT / folder).as_posix()
            ref = add(folder + "/" + rel, isa="PBXFileReference", lastKnownFileType="sourcecode.swift", path=rel, sourceTree="<group>")
            source_refs.append(ref)
            source_builds.append(add(folder + "/" + rel + "/build", isa="PBXBuildFile", fileRef=ref))
        if kind == "app":
            for path, file_type in [("Assets.xcassets", "folder.assetcatalog"), ("PrivacyInfo.xcprivacy", "text.xml")]:
                if (ROOT / folder / path).exists():
                    ref = add(folder + "/" + path, isa="PBXFileReference", lastKnownFileType=file_type, path=path, sourceTree="<group>")
                    source_refs.append(ref)
                    resource_builds.append(add(folder + "/" + path + "/build", isa="PBXBuildFile", fileRef=ref))
        groups.append(add(kind + "-group", isa="PBXGroup", children=source_refs, path=folder, sourceTree="<group>"))
        product = add(kind + "-product", isa="PBXFileReference", explicitFileType="wrapper.application" if kind == "app" else "wrapper.cfbundle", includeInIndex=0, path=folder + suffix, sourceTree="BUILT_PRODUCTS_DIR")
        products.append(product)
        phases = [
            add(kind + "-sources", isa="PBXSourcesBuildPhase", buildActionMask=2147483647, files=source_builds, runOnlyForDeploymentPostprocessing=0),
            add(kind + "-frameworks", isa="PBXFrameworksBuildPhase", buildActionMask=2147483647, files=[], runOnlyForDeploymentPostprocessing=0),
            add(kind + "-resources", isa="PBXResourcesBuildPhase", buildActionMask=2147483647, files=resource_builds, runOnlyForDeploymentPostprocessing=0),
        ]
        settings = dict(PRODUCT_NAME="$(TARGET_NAME)", PRODUCT_BUNDLE_IDENTIFIER="com.besleyslab." + folder.lower(), SWIFT_VERSION="5.0", IPHONEOS_DEPLOYMENT_TARGET="17.0", TARGETED_DEVICE_FAMILY="1,2", CODE_SIGN_STYLE="Automatic", SUPPORTED_PLATFORMS="iphoneos iphonesimulator", SUPPORTS_MACCATALYST="NO", SWIFT_EMIT_LOC_STRINGS="YES")
        dependencies = []
        if kind == "app":
            settings.update(INFOPLIST_FILE=f"Configuration/{name}-Info.plist", GENERATE_INFOPLIST_FILE="NO", ASSETCATALOG_COMPILER_APPICON_NAME="AppIcon", ENABLE_PREVIEWS="YES", LD_RUNPATH_SEARCH_PATHS=["$(inherited)", "@executable_path/Frameworks"], MARKETING_VERSION="1.0", CURRENT_PROJECT_VERSION="1")
        else:
            settings.update(GENERATE_INFOPLIST_FILE="YES", LD_RUNPATH_SEARCH_PATHS=["$(inherited)", "@executable_path/Frameworks", "@loader_path/Frameworks"])
            if kind == "unit":
                settings.update(TEST_HOST=f"$(BUILT_PRODUCTS_DIR)/{name}.app/$(BUNDLE_EXECUTABLE_FOLDER_PATH)/{name}", BUNDLE_LOADER="$(TEST_HOST)")
            else:
                settings.update(TEST_TARGET_NAME=name)
            proxy = add(kind + "-proxy", isa="PBXContainerItemProxy", containerPortal=ident("project"), proxyType=1, remoteGlobalIDString=app_target, remoteInfo=name)
            dependencies.append(add(kind + "-dependency", isa="PBXTargetDependency", target=app_target, targetProxy=proxy))
        configs = configurations(kind, settings)
        targets.append(add(kind + "-target", isa="PBXNativeTarget", buildConfigurationList=configs, buildPhases=phases, buildRules=[], dependencies=dependencies, name=folder, productName=folder, productReference=product, productType=product_type))

    products_group = add("products", isa="PBXGroup", children=products, name="Products", sourceTree="<group>")
    config_refs = [add("info-ref", isa="PBXFileReference", lastKnownFileType="text.plist.xml", path=f"Configuration/{name}-Info.plist", sourceTree="<group>")]
    root_group = add("root-group", isa="PBXGroup", children=groups + config_refs + [products_group], sourceTree="<group>")
    project_configs = configurations("project", dict(ALWAYS_SEARCH_USER_PATHS="NO", CLANG_ENABLE_MODULES="YES", CLANG_ENABLE_OBJC_ARC="YES", CLANG_WARN_DOCUMENTATION_COMMENTS="YES", GCC_C_LANGUAGE_STANDARD="gnu17", SDKROOT="iphoneos", IPHONEOS_DEPLOYMENT_TARGET="17.0", SWIFT_VERSION="5.0"))
    project_id = add("project", isa="PBXProject", attributes={"BuildIndependentTargetsInParallel": "YES", "LastUpgradeCheck": "2600", "TargetAttributes": {target: {"CreatedOnToolsVersion": "26.6"} for target in targets}}, buildConfigurationList=project_configs, compatibilityVersion="Xcode 14.0", developmentRegion="en", hasScannedForEncodings=0, knownRegions=["en", "Base"], mainGroup=root_group, productRefGroup=products_group, projectDirPath="", projectRoot="", targets=targets)
    project = {"archiveVersion": 1, "classes": {}, "objectVersion": 56, "objects": objects, "rootObject": project_id}
    folder = ROOT / (name + ".xcodeproj")
    folder.mkdir(exist_ok=True)
    (folder / "project.pbxproj").write_text("// !$*UTF8*$!\n" + atom(project) + "\n")

    def reference(kind, suffix):
        target_name = name + suffix
        return f'<BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{ident(kind + "-target")}" BuildableName="{target_name}{".app" if not suffix else ".xctest"}" BlueprintName="{target_name}" ReferencedContainer="container:{name}.xcodeproj"/>'
    app_ref = reference("app", "")
    scheme = f'''<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion="2600" version="1.3">
  <BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES"><BuildActionEntries><BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="YES" buildForArchiving="YES" buildForAnalyzing="YES">{app_ref}</BuildActionEntry></BuildActionEntries></BuildAction>
  <TestAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" shouldUseLaunchSchemeArgsEnv="YES"><Testables><TestableReference skipped="NO">{reference("unit", "Tests")}</TestableReference><TestableReference skipped="NO">{reference("ui", "UITests")}</TestableReference></Testables></TestAction>
  <LaunchAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" launchStyle="0" useCustomWorkingDirectory="NO" ignoresPersistentStateOnLaunch="NO" debugServiceExtension="internal" allowLocationSimulation="YES"><BuildableProductRunnable runnableDebuggingMode="0">{app_ref}</BuildableProductRunnable></LaunchAction>
  <ProfileAction buildConfiguration="Release" shouldUseLaunchSchemeArgsEnv="YES" savedToolIdentifier="" useCustomWorkingDirectory="NO" debugDocumentVersioning="YES"><BuildableProductRunnable runnableDebuggingMode="0">{app_ref}</BuildableProductRunnable></ProfileAction>
  <AnalyzeAction buildConfiguration="Debug"/>
  <ArchiveAction buildConfiguration="Release" revealArchiveInOrganizer="YES"/>
</Scheme>
'''
    schemes = folder / "xcshareddata/xcschemes"
    schemes.mkdir(parents=True, exist_ok=True)
    (schemes / (name + ".xcscheme")).write_text(scheme)
    ext = "gather" if name == "Gather" else "keepsbackup"
    type_id = "com.besleyslab.gather.document" if name == "Gather" else "com.besleyslab.keeps.backup"
    description = "Gather invitation or ballot" if name == "Gather" else "Keeps library backup"
    info = {
        "CFBundleDevelopmentRegion": "$(DEVELOPMENT_LANGUAGE)", "CFBundleDisplayName": name,
        "CFBundleExecutable": "$(EXECUTABLE_NAME)", "CFBundleIdentifier": "$(PRODUCT_BUNDLE_IDENTIFIER)",
        "CFBundleInfoDictionaryVersion": "6.0", "CFBundleName": "$(PRODUCT_NAME)", "CFBundlePackageType": "APPL",
        "CFBundleShortVersionString": "$(MARKETING_VERSION)", "CFBundleVersion": "$(CURRENT_PROJECT_VERSION)",
        "LSRequiresIPhoneOS": True, "UILaunchScreen": {}, "UIApplicationSupportsIndirectInputEvents": True,
        "UIApplicationSceneManifest": {"UIApplicationSupportsMultipleScenes": False},
        "UISupportedInterfaceOrientations": ["UIInterfaceOrientationPortrait", "UIInterfaceOrientationLandscapeLeft", "UIInterfaceOrientationLandscapeRight"],
        "UISupportedInterfaceOrientations~ipad": ["UIInterfaceOrientationPortrait", "UIInterfaceOrientationPortraitUpsideDown", "UIInterfaceOrientationLandscapeLeft", "UIInterfaceOrientationLandscapeRight"],
        "LSSupportsOpeningDocumentsInPlace": True,
        "CFBundleURLTypes": [{"CFBundleURLName": "com.besleyslab." + name.lower(), "CFBundleURLSchemes": [name.lower()]}],
        "CFBundleDocumentTypes": [{"CFBundleTypeName": description, "CFBundleTypeRole": "Editor", "LSHandlerRank": "Owner", "LSItemContentTypes": [type_id]}],
        "UTExportedTypeDeclarations": [{"UTTypeIdentifier": type_id, "UTTypeDescription": description, "UTTypeConformsTo": ["public.json"], "UTTypeTagSpecification": {"public.filename-extension": [ext], "public.mime-type": ["application/json"]}}],
    }
    if name == "Orbit":
        # Orbit exchanges rooms through native networking; it does not own document files.
        for key in ["LSSupportsOpeningDocumentsInPlace", "CFBundleDocumentTypes", "UTExportedTypeDeclarations"]:
            info.pop(key, None)
        current_info = ROOT / "Configuration" / "Orbit-Info.plist"
        service_url = "https://orbit-together-placeholder.example"
        if current_info.exists():
            service_url = plistlib.loads(current_info.read_bytes()).get("OrbitServiceURL", service_url)
        info.update({
            "OrbitServiceURL": service_url,
            "NSLocalNetworkUsageDescription": "Orbit connects to a nearby room when you choose Nearby. Keep Orbit open to sync with people you approve.",
            "NSBonjourServices": ["_orbit-room._tcp"],
            "NSLocationWhenInUseUsageDescription": "Find places near you when you tap Use my location. You can search by city instead.",
            "NSRemindersFullAccessUsageDescription": "Add a reminder to your default Reminders list when you choose Add to Reminders. Orbit does not read your existing reminders.",
        })
    (ROOT / "Configuration" / f"{name}-Info.plist").write_bytes(plistlib.dumps(info, sort_keys=False))
    print(f"Generated {name}.xcodeproj ({len(objects)} objects)")


if __name__ == "__main__":
    selected_names = sys.argv[1:] or APP_NAMES
    if any(name not in APP_NAMES for name in selected_names):
        raise SystemExit("Choose one or more of: " + ", ".join(APP_NAMES))
    for name in selected_names:
        build(name)
    workspace = ROOT / "ChoiceApps.xcworkspace"
    workspace.mkdir(exist_ok=True)
    (workspace / "contents.xcworkspacedata").write_text('''<?xml version="1.0" encoding="UTF-8"?>
<Workspace version="1.0">
    <FileRef location="group:Gather.xcodeproj"/>
    <FileRef location="group:Keeps.xcodeproj"/>
    <FileRef location="group:Orbit.xcodeproj"/>
</Workspace>
''')
