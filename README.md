# grist-plugin-examples

Minimal examples of grist plugins

### Install

```
mkdir -p ~/.grist/plugins
git clone https://github.com/gristlabs/grist-plugin-examples.git
cp -R grist-plugin-examples/examples/ ~/.grist/plugins
```

### Examples
|Example|Features|
|-------|--------|
|example-1-count-to-10|`ImportSourceAPI`, `SafeBrowser`|
|example-2-line-stats|`ParseFileAPI`, `SafePython`|
|example-3-github|`ImportSourceAPI`, `SafeBrowser`|
|example-4-ps-aux|`ImportSourceAPI`, `UnsafeNode`|
|example-5-shopify|`ImportSourceAPI`, `UnsafeNode`, `SafeBrowser`|
|example-6-map|`GristDocAPI`, `SafeBrowser`, `customSections`|

### How to use

Some examples may require an additional build step. Please consult each example's README.md for
details. For example, Shopify (Example 5) requires an `npm install` step and a local configuration
file with Shopify credentials.

Examples with `ImportSourceAPI` can be used from the "Import" menu
in the top right of Grist when editing a document.

![Import menu](https://user-images.githubusercontent.com/118367/44528270-19fc6f00-a6b7-11e8-9cea-0e171337d810.png)

Examples with `ParseFileAPI` can be used from the "Import" button
on the left when viewing a list of documents, or from the "Import from file"
entry in the "Import" menu.  Just pick a file
with the extension that the example expects (you might have
to read the example to figure this out).

![Import button](https://user-images.githubusercontent.com/118367/44528271-19fc6f00-a6b7-11e8-9caa-e8c913155523.png)

Examples with `customSections` can be used by creating a custom section,
and then in its view options selecting the given plugin and section.

![Add custom section](https://user-images.githubusercontent.com/118367/45760330-c880ca80-bbf7-11e8-8121-428f953b00d9.png)
![Custom section plugin](https://user-images.githubusercontent.com/118367/45759918-fb768e80-bbf6-11e8-9bd9-d183ee2d54c6.png)
