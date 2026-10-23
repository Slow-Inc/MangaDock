// Real React and Mobile code; only OS widgets, image picker/files and platform services are substituted.
import { registerHooks, createRequire } from "node:module";
import { readFileSync } from "node:fs";
import ts from "typescript";
const require = createRequire(import.meta.url);
const reactUrl = new URL(
  `file:///${require.resolve("react").replaceAll("\\", "/")}`,
).href;
export const native = {
  back: [] as Array<() => boolean>,
  images: {
    canceled: true,
    assets: [] as Array<{ uri: string; mimeType: string; fileName: string }>,
  },
  files: new Map<string, Blob>(),
  scrolls: [] as Array<{ index?: number; offset?: number }>,
  insets: { top: 0, bottom: 0, left: 0, right: 0 },
  pressBack() {
    return [...this.back].reverse().some((listener) => listener());
  },
};
Object.assign(globalThis, {
  __mangaNativeBoundary: native,
  IS_REACT_ACT_ENVIRONMENT: true,
  requestAnimationFrame: (fn: () => void) => setTimeout(fn, 0),
  cancelAnimationFrame: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
});
const mocks: Record<string, string> = {
  "react-native": `import React from ${JSON.stringify(reactUrl)};
    const os = globalThis.__mangaNativeBoundary;
    export const View='View', Text='Text', TextInput='TextInput', Pressable='Pressable', ScrollView='ScrollView', Modal='Modal', ActivityIndicator='ActivityIndicator', KeyboardAvoidingView='KeyboardAvoidingView';
    export const Platform={OS:'android'}, StyleSheet={create:x=>x,absoluteFillObject:{}};
    export const Linking={openSettings:async()=>{}};
    export const Alert={alert(){}}, AppState={currentState:'active',addEventListener:()=>({remove(){}})};
    export const BackHandler={addEventListener:(name,fn)=>{os.back.push(fn);return {remove(){const i=os.back.indexOf(fn);if(i>=0)os.back.splice(i,1);}}}};
    export const Image=Object.assign((props)=>React.createElement('Image',props),{getSize:(uri,done)=>done(100,140),prefetch:async()=>true,abortPrefetch(){}});
    export const PanResponder={create:handlers=>({panHandlers:handlers})}, useWindowDimensions=()=>({width:390,height:844,scale:1,fontScale:1});
    export const FlatList=React.forwardRef((p,ref)=>{React.useImperativeHandle(ref,()=>({scrollToIndex(args){os.scrolls.push(args)},scrollToOffset(args){os.scrolls.push(args)}}));return React.createElement('FlatList',p,p.ListHeaderComponent,(p.data??[]).map((item,index)=>React.createElement(React.Fragment,{key:p.keyExtractor?.(item,index)??index},p.renderItem?.({item,index}))),p.ListFooterComponent);});`,
  "react-native-safe-area-context":
    "export const SafeAreaView='SafeAreaView'; export const useSafeAreaInsets=()=>globalThis.__mangaNativeBoundary.insets;",
  "@react-native-async-storage/async-storage":
    "const rows=new Map();export default {getItem:async k=>rows.get(k)??null,setItem:async(k,v)=>{rows.set(k,v)},removeItem:async k=>{rows.delete(k)}};",
  "expo-image-picker":
    "export async function launchImageLibraryAsync(){return globalThis.__mangaNativeBoundary.images}",
  "expo-file-system":
    "export class File{constructor(uri){return globalThis.__mangaNativeBoundary.files.get(uri)}} export const Paths={cache:'cache'};",
  "expo-crypto": "export const randomUUID=()=>crypto.randomUUID();",
  "expo-web-browser":
    "export const openAuthSessionAsync=async()=>({type:'cancel'});",
  "expo-sharing":
    "export const isAvailableAsync=async()=>true;export const shareAsync=async()=>{};",
  "expo-media-library":
    "export const requestPermissionsAsync=async()=>({granted:false});export const saveToLibraryAsync=async()=>{};",
};
registerHooks({
  resolve(specifier, context, next) {
    if (mocks[specifier])
      return {
        url: `data:text/javascript,${encodeURIComponent(mocks[specifier])}`,
        shortCircuit: true,
      };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith(".tsx") && url.includes("/Mobile/src/")) {
      const source = readFileSync(new URL(url), "utf8");
      return {
        format: "module",
        source:
          "const require=(asset)=>({uri:asset});\n" +
          ts.transpileModule(source, {
            compilerOptions: {
              module: ts.ModuleKind.ESNext,
              target: ts.ScriptTarget.ES2022,
              jsx: ts.JsxEmit.ReactJSX,
            },
          }).outputText,
        shortCircuit: true,
      };
    }
    return next(url, context);
  },
});
