import * as path from 'path'; // is this ok?
import * as fs from 'fs-extra';
import { WorkspaceContext, shared, utils, componentUtil } from 'lightning-lsp-common';
import { readJsonSync, writeJsonSync } from 'lightning-lsp-common/lib/utils';
import { FORCE_APP_ROOT } from './html-language-service/__tests__/test-utils';

const { WorkspaceType } = shared;

// file ==> add to jsconfig.json "paths" {tag, [relativePath]}, see http://www.typescriptlang.org/docs/handbook/module-resolution.html

export interface IPaths {
    [tag: string]: string[];
}
export interface IJsconfig {
    compilerOptions: {
        baseUrl?: string;
        paths?: IPaths;
    };
}
// this listens and i have to detect where this file is coming from
export async function onIndexCustomComponents(context: WorkspaceContext, files: string[]) {
    // set paths for all current components in all the projects jsconfig.json files
    for (const relativeModulesDir of await context.getRelativeModulesDirs()) {
        // for core single, this would be workspaceroot/modules
        const modulesDir = path.join(context.workspaceRoot, relativeModulesDir);

        const paths: IPaths = {};
        for (const file of files) {
            const tag = componentUtil.moduleFromFile(file, context.type === WorkspaceType.SFDX);
            // path must be relative to location of jsconfig.json
            const relativeFilePath = utils.relativePath(modulesDir, file);
            paths[tag] = [relativeFilePath];
        }

        // set "paths" in jsconfig.json
        const relativeJsConfigPath = path.join(relativeModulesDir, 'jsconfig.json');
        // are there multiple jsonconfigFiles?
        const jsconfigFile = path.join(context.workspaceRoot, relativeJsConfigPath);
        try {
            // note, this read/write file must be synchronous, so it is atomic
            const jsconfig: IJsconfig = readJsonSync(jsconfigFile);
            if (
                !jsconfig.compilerOptions ||
                !jsconfig.compilerOptions.hasOwnProperty('baseUrl') ||
                jsconfig.compilerOptions.baseUrl !== '.' ||
                !jsconfig.compilerOptions.hasOwnProperty('paths') ||
                JSON.stringify(jsconfig.compilerOptions.paths) !== JSON.stringify(paths)
            ) {
                if (!jsconfig.compilerOptions) {
                    jsconfig.compilerOptions = {};
                }
                jsconfig.compilerOptions.baseUrl = '.';
                jsconfig.compilerOptions.paths = paths;
                writeJsonSync(jsconfigFile, jsconfig);
            }
        } catch (err) {
            console.log(`onIndexCustomComponents(LOTS): Error reading jsconfig ${jsconfigFile}`, err);
        }
    }
}

export async function onCreatedCustomComponent(context: WorkspaceContext, file: string): Promise<void> {
    if (!file) {
        // could be a non-local tag, like LGC, etc
        return;
    }
    // add tag/path to component to all the project's jsconfig.json "paths"
    const moduleTag = componentUtil.moduleFromFile(file, context.type === WorkspaceType.SFDX);
    for (const relativeModulesDir of await context.getRelativeModulesDirs()) {
        // for (const ws of context.workspaceRoots) {
        //     const modulesDir = path.join(ws, relativeModulesDir);
        //     console.log(modulesDir);
        //     const relativeFilePath = utils.relativePath(modulesDir, file);
        //     if (await fs.pathExists(relativeFilePath)) {

        //     }

        // }

        const modulesDir = path.join(context.workspaceRoot, relativeModulesDir);
        console.log(modulesDir);

        // path must be relative to location of jsconfig.json
        // MUST SEE IF THIS PATH EXISTS FIRST, SEE AURA MODULE THING
        const relativeFilePath = utils.relativePath(modulesDir, file);

        // await fs.pathExists(modulesDir)

        // update "paths" in jsconfig.json
        const relativeJsConfigPath = path.join(relativeModulesDir, 'jsconfig.json');
        const jsconfigFile = path.join(context.workspaceRoot, relativeJsConfigPath);
        try {
            // note, this read/write file must be synchronous, so it is atomic
            const jsconfig: IJsconfig = readJsonSync(jsconfigFile);
            if (!jsconfig.compilerOptions) {
                jsconfig.compilerOptions = {};
            }
            jsconfig.compilerOptions.baseUrl = '.';
            if (!jsconfig.compilerOptions.paths) {
                jsconfig.compilerOptions.paths = {};
            }
            jsconfig.compilerOptions.paths[moduleTag] = [relativeFilePath];
            writeJsonSync(jsconfigFile, jsconfig);
        } catch (err) {
            console.log(`onCreatedCustomComponent(${file}): Error reading jsconfig ${jsconfigFile}`, err);
        }
    }
}

export async function onDeletedCustomComponent(moduleTag: string, context: WorkspaceContext): Promise<void> {
    // delete tag from all the project's jsconfig.json "paths"
    for (const relativeModulesDir of await context.getRelativeModulesDirs()) {
        const relativeJsConfigPath = path.join(relativeModulesDir, 'jsconfig.json');
        const jsconfigFile = path.join(context.workspaceRoot, relativeJsConfigPath);
        try {
            // note, this read/write file must be synchronous, so it is atomic
            const jsconfig: IJsconfig = readJsonSync(jsconfigFile);
            if (jsconfig.compilerOptions) {
                if (jsconfig.compilerOptions.paths) {
                    delete jsconfig.compilerOptions.paths[moduleTag];
                    writeJsonSync(jsconfigFile, jsconfig);
                }
            }
        } catch (err) {
            console.log(`onDeletedCustomComponent${moduleTag}: Error reading jsconfig ${jsconfigFile}`, err);
        }
    }
}
