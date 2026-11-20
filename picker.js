"use strict";

class CampusPicker {
  constructor(element) {
    this.element=element;
    this.summary=element.querySelector("summary");
    this.list=element.querySelector("fieldset");
    this.inputs=new Map();
    this.list.addEventListener("change",event=>{
      this.value=event.target.value;
      this.element.open=false;
    });
  }
  setOptions(options, selected=options[0]?.[0]) {
    this.inputs.clear();
    this.list.replaceChildren(...options.map(([value,text])=>{
      const label=document.createElement("label"),input=document.createElement("input");
      const title=document.createElement("span");
      input.type="radio";
      input.name=this.element.id;
      input.value=value;
      title.textContent=text;
      label.append(input,title);
      this.inputs.set(value,input);
      return label;
    }));
    this.element.open=false;
    this.value=selected;
  }
  get value() { return this.selected; }
  set value(value) {
    const input=this.inputs.get(value);
    if(!input) return;
    this.selected=value;
    input.checked=true;
    this.summary.textContent=input.labels[0].textContent;
  }
}
