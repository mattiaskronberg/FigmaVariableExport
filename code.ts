// This plugin will open a window to prompt the user to enter a number, and
// it will then create that many rectangles on the screen.

// This file holds the main code for plugins. Code in this file has access to
// the *figma document* via the figma global object.
// You can access browser APIs in the <script> tag inside "ui.html" which has a
// full browser environment (See https://www.figma.com/plugin-docs/how-plugins-run).

// This shows the HTML page in "ui.html".
figma.showUI(__html__);

interface ExportCollectionsMessage {
  type: 'export-selected-collections';
  selectedItems: string[];
}

var variableCollections: VariableCollection[];

// Loads the different variable collections and returns them to the UI
async function populateCheckboxes() {
  const variablesPromise = figma.variables.getLocalVariableCollectionsAsync();
  var result = (await variablesPromise).map(variable => ({ id: variable.id, name: variable.name }));

  if (result.length > 0)
    figma.ui.postMessage({ type: "variableCollectionsFound", data: result });
  else
    figma.ui.postMessage({ type: "noCollectionFound", data: null });

};

// Method for messages from the UI
figma.ui.onmessage = msg => {
  if (msg.type === 'export-selected-collections') {
    if (msg.selectedCollections.length != 0) {
      exportSelectedCollections(msg.selectedCollections);
    }
  }
};

// Method for when the plugin starts running
figma.on("run", () => {
  populateCheckboxes();
});

async function exportSelectedCollections(selectedCollections: string[]) {
  console.log(selectedCollections);
  const allVariableCollections = await figma.variables.getLocalVariableCollectionsAsync();
  const variables = await figma.variables.getLocalVariablesAsync();

  /*
      variables.forEach(v => {
        if (selectedCollections.includes(v.variableCollectionId)) {
          
          console.log(v.name.split("/").slice(-1) + " : " + v.valuesByMode[0]);
        }
      })*/

  allVariableCollections.forEach(collection => {

    // Check if collection was selected
    if (isInCollection(collection, selectedCollections)) {
      var modes = collection.modes;
      var ids = collection.variableIds;

      // Loop through the modes in the collection
      modes.forEach(m => {
        // Loop through the variables in the collection
        ids.forEach(async id => {
          // Get the specific variable
          var v = await figma.variables.getVariableByIdAsync(id);
          if (v != null) {
            // Get the string values for the variables
            console.log(v.name + " : " + await getVariableString(v, m))
          }

        })
      })
    }
  });
}

async function getVariableString(v: Variable, mode: { name: string, modeId: string }) {
  var value = v.valuesByMode[mode.modeId];
  const converted = await variableToString(value, v.resolvedType);
  console.log("Everything is converted now. The variable name is " + v.name + " and the value is " + converted);
  return converted;

}


async function variableToString(v: VariableValue, resolvedType: VariableResolvedDataType) {

  // Is this check needed?
  if (v !== undefined && ["COLOR", "FLOAT", "BOOLEAN", "STRING"].includes(resolvedType)) {

    // Check if the variable is referencing another variable in another layer
    // and if so, get that variable and return its name
    var alias = v as { type: string, id: string };
    if (alias.type == "VARIABLE_ALIAS") {
      return (await figma.variables.getVariableByIdAsync(alias.id))?.name;
    }

    // If the variable refers a pure value, return it as string (HEX for COLORS)
    switch (resolvedType) {
      case "COLOR":
        const { r, g, b, a = 1 } = v as RGBA;  // Default alpha (a) to 1 if not present
        return rgbToHex(r, g, b, a);
      case "BOOLEAN":
        return v as boolean;
    }

    return v;
  }
}

// Utility method for converting rgb to a hex string
function rgbToHex(r: number, g: number, b: number, a: number) {
  if (a !== 1) {
    return `rgba(${[r, g, b]
      .map((n) => Math.round(n * 255))
      .join(", ")}, ${a.toFixed(4)})`;
  }
  const toHex = (value: number) => {
    const hex = Math.round(value * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  const hex = [toHex(r), toHex(g), toHex(b)].join("");
  return `#${hex}`;
}


function isInCollection(collection: VariableCollection, selected: string[]) {
  return selected.findIndex((x) => collection.id == x) != -1;
}

